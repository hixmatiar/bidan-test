import sql from 'mssql';
import { env } from '@/config/env';

const poolConfig: sql.config = {
  server: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  options: {
    encrypt: env.DB_ENCRYPT,
    trustServerCertificate: env.DB_TRUST_CERT,
  },
  pool: {
    max: env.DB_POOL_MAX,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let connection: Promise<sql.ConnectionPool> | null = null;

export function getPool(): Promise<sql.ConnectionPool> {
  if (!connection) {
    const pool = new sql.ConnectionPool(poolConfig);
    connection = pool.connect().catch((error: unknown) => {
      connection = null;
      throw error;
    });
  }
  return connection;
}

// ponytail: mssql multiplexes one pool; each request borrows and returns a connection itself.
export function acquire(): Promise<sql.ConnectionPool> {
  return getPool();
}

export function release(_pool: sql.ConnectionPool): void {
  // Nothing to hand back: the pool reclaims the connection when the request finishes.
}

export async function withTransaction<T>(
  fn: (transaction: sql.Transaction) => Promise<T>,
): Promise<T> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {
      // rollback is best-effort: the connection may already be aborted by SQL Server
    }
    throw error;
  }
}
