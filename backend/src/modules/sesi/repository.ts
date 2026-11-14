import { randomUUID } from 'crypto';
import type { ConnectionPool } from 'mssql';
import sql from 'mssql';
import type { CreateSesiInput, UpdateSesiInput } from './validators';

export interface SesiRow {
  sesi_id: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  kuota_maks: number;
  durasi_per_pasien: number;
  is_active: boolean;
  terpakai: number;
  sisa_kuota: number;
}

export interface SesiFilters {
  tanggal_dari?: string;
  tanggal_sampai?: string;
  is_active?: boolean;
}

// ponytail: tedious Time params reject 'HH:mm:ss' strings; they need Date objects.
function timeValue(value: string): Date {
  return new Date(`1970-01-01T${value}Z`);
}

const SELECT_COLUMNS = `
  CONVERT(char(10), tanggal, 23) AS tanggal,
  CONVERT(char(8), jam_mulai, 108) AS jam_mulai,
  CONVERT(char(8), jam_selesai, 108) AS jam_selesai,
  sesi_id,
  kuota_maks,
  durasi_per_pasien,
  is_active,
  terpakai,
  sisa_kuota
`;

export async function findById(
  db: ConnectionPool,
  sesiId: string,
): Promise<SesiRow | null> {
  const result = await db
    .request()
    .input('id', sql.UniqueIdentifier, sesiId)
    .query<SesiRow>(
      `SELECT ${SELECT_COLUMNS} FROM dbo.v_sesi_sisa_kuota WHERE sesi_id = @id`,
    );
  return result.recordset[0] ?? null;
}

export async function list(
  db: ConnectionPool,
  filters: SesiFilters,
  page: number,
  perPage: number,
): Promise<{ rows: SesiRow[]; total: number }> {
  const conditions: string[] = [];
  if (filters.tanggal_dari !== undefined) conditions.push('tanggal >= @dari');
  if (filters.tanggal_sampai !== undefined) conditions.push('tanggal <= @sampai');
  if (filters.is_active !== undefined) conditions.push('is_active = @isActive');

  const bind = (request: sql.Request): sql.Request => {
    if (filters.tanggal_dari !== undefined) {
      request.input('dari', sql.Date, filters.tanggal_dari);
    }
    if (filters.tanggal_sampai !== undefined) {
      request.input('sampai', sql.Date, filters.tanggal_sampai);
    }
    if (filters.is_active !== undefined) {
      request.input('isActive', sql.Bit, filters.is_active);
    }
    return request;
  };

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await bind(db.request()).query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM dbo.v_sesi_sisa_kuota ${where}`,
  );

  const offset = (page - 1) * perPage;
  const rowsResult = await bind(db.request())
    .input('offset', sql.Int, offset)
    .input('perPage', sql.Int, perPage)
    .query<SesiRow>(
      `SELECT ${SELECT_COLUMNS}
       FROM dbo.v_sesi_sisa_kuota
       ${where}
       ORDER BY tanggal, jam_mulai
       OFFSET @offset ROWS FETCH NEXT @perPage ROWS ONLY`,
    );

  return {
    rows: rowsResult.recordset,
    total: countResult.recordset[0]?.total ?? 0,
  };
}

export async function countOverlap(
  db: ConnectionPool,
  tanggal: string,
  jamMulai: string,
  jamSelesai: string,
  excludeId?: string,
): Promise<number> {
  const request = db
    .request()
    .input('tanggal', sql.Date, tanggal)
    .input('jamMulai', sql.Time, timeValue(jamMulai))
    .input('jamSelesai', sql.Time, timeValue(jamSelesai));

  const exclude = excludeId ? 'AND sesi_id <> @excludeId' : '';
  if (excludeId) request.input('excludeId', sql.UniqueIdentifier, excludeId);

  const result = await request.query<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM dbo.sesi_praktik
     WHERE tanggal = @tanggal
       AND jam_mulai < @jamSelesai
       AND jam_selesai > @jamMulai
       ${exclude}`,
  );
  return result.recordset[0]?.total ?? 0;
}

export async function countActiveReservations(
  db: ConnectionPool,
  sesiId: string,
): Promise<number> {
  const result = await db
    .request()
    .input('id', sql.UniqueIdentifier, sesiId)
    .query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM dbo.reservasi
       WHERE sesi_id = @id AND status <> 'DIBATALKAN'`,
    );
  return result.recordset[0]?.total ?? 0;
}

export async function create(
  db: ConnectionPool,
  input: CreateSesiInput,
): Promise<string> {
  // ponytail: OUTPUT is illegal on a table with audit triggers, so the id comes from the app.
  const sesiId = randomUUID();
  await db
    .request()
    .input('id', sql.UniqueIdentifier, sesiId)
    .input('tanggal', sql.Date, input.tanggal)
    .input('jamMulai', sql.Time, timeValue(input.jam_mulai))
    .input('jamSelesai', sql.Time, timeValue(input.jam_selesai))
    .input('kuota', sql.Int, input.kuota_maks)
    .input('durasi', sql.Int, input.durasi_per_pasien)
    .query(
      `INSERT INTO dbo.sesi_praktik
         (sesi_id, tanggal, jam_mulai, jam_selesai, kuota_maks, durasi_per_pasien)
       VALUES (@id, @tanggal, @jamMulai, @jamSelesai, @kuota, @durasi)`,
    );
  return sesiId;
}

export async function update(
  db: ConnectionPool,
  sesiId: string,
  input: UpdateSesiInput,
): Promise<void> {
  const sets: string[] = [];
  const request = db.request().input('id', sql.UniqueIdentifier, sesiId);

  if (input.tanggal !== undefined) {
    sets.push('tanggal = @tanggal');
    request.input('tanggal', sql.Date, input.tanggal);
  }
  if (input.jam_mulai !== undefined) {
    sets.push('jam_mulai = @jamMulai');
    request.input('jamMulai', sql.Time, timeValue(input.jam_mulai));
  }
  if (input.jam_selesai !== undefined) {
    sets.push('jam_selesai = @jamSelesai');
    request.input('jamSelesai', sql.Time, timeValue(input.jam_selesai));
  }
  if (input.kuota_maks !== undefined) {
    sets.push('kuota_maks = @kuota');
    request.input('kuota', sql.Int, input.kuota_maks);
  }
  if (input.durasi_per_pasien !== undefined) {
    sets.push('durasi_per_pasien = @durasi');
    request.input('durasi', sql.Int, input.durasi_per_pasien);
  }
  if (input.is_active !== undefined) {
    sets.push('is_active = @isActive');
    request.input('isActive', sql.Bit, input.is_active);
  }

  sets.push('updated_at = SYSDATETIME()');

  await request.query(
    `UPDATE dbo.sesi_praktik SET ${sets.join(', ')} WHERE sesi_id = @id`,
  );
}
