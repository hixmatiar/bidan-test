import sql from 'mssql';

type Db = sql.ConnectionPool;

export interface AuditLogRow {
  log_id: number;
  user_id: string | null;
  username: string | null;
  user_ref: string | null;
  aksi: string;
  entitas: string;
  entitas_id: string | null;
  nilai_lama: unknown;
  nilai_baru: unknown;
  ip_address: string | null;
  created_at: Date;
}

export interface ListAuditLogsFilter {
  q?: string;
  aksi?: string;
  entitas?: string;
  user_id?: string;
  tanggal_dari?: string;
  tanggal_sampai?: string;
}

interface Param {
  name: string;
  type: sql.ISqlType | (() => sql.ISqlType);
  value: unknown;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const key of Object.keys(parsed as Record<string, unknown>)) {
        if (/password/i.test(key)) delete (parsed as Record<string, unknown>)[key];
      }
    }
    return parsed;
  } catch {
    return value;
  }
}

export async function listAuditLogs(
  db: Db,
  filter: ListAuditLogsFilter,
  page: number,
  perPage: number,
): Promise<{ rows: AuditLogRow[]; total: number }> {
  const where: string[] = [];
  const params: Param[] = [
    { name: 'offset', type: sql.Int, value: (page - 1) * perPage },
    { name: 'limit', type: sql.Int, value: perPage },
  ];

  if (filter.q) {
    where.push(`(
      COALESCE(u.username, a.user_ref) LIKE @q OR
      a.entitas LIKE @q OR
      a.entitas_id LIKE @q OR
      a.aksi LIKE @q OR
      a.ip_address LIKE @q
    )`);
    params.push({ name: 'q', type: sql.NVarChar(200), value: `%${filter.q}%` });
  }
  if (filter.aksi) {
    where.push('a.aksi = @aksi');
    params.push({ name: 'aksi', type: sql.VarChar(30), value: filter.aksi });
  }
  if (filter.entitas) {
    where.push('a.entitas = @entitas');
    params.push({ name: 'entitas', type: sql.VarChar(50), value: filter.entitas });
  }
  if (filter.user_id) {
    where.push('a.user_id = @user_id');
    params.push({ name: 'user_id', type: sql.UniqueIdentifier, value: filter.user_id });
  }
  if (filter.tanggal_dari) {
    where.push('CAST(a.created_at AS DATE) >= @tanggal_dari');
    params.push({ name: 'tanggal_dari', type: sql.Date, value: filter.tanggal_dari });
  }
  if (filter.tanggal_sampai) {
    where.push('CAST(a.created_at AS DATE) <= @tanggal_sampai');
    params.push({ name: 'tanggal_sampai', type: sql.Date, value: filter.tanggal_sampai });
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const fromSql = `
    FROM dbo.audit_logs AS a
    LEFT JOIN dbo.users AS u ON u.user_id = a.user_id
  `;

  const request = db.request();
  for (const param of params) request.input(param.name, param.type, param.value);

  const { recordsets } = await request.query(`
    SELECT COUNT(*) AS total ${fromSql} ${whereSql};
    SELECT
      a.log_id,
      a.user_id,
      COALESCE(u.username, a.user_ref) AS username,
      a.user_ref,
      a.aksi,
      a.entitas,
      a.entitas_id,
      a.nilai_lama,
      a.nilai_baru,
      a.ip_address,
      a.created_at
    ${fromSql}
    ${whereSql}
    ORDER BY a.created_at DESC, a.log_id DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  `);
  const sets = Array.isArray(recordsets) ? recordsets : Object.values(recordsets);
  const count = sets[0]?.[0] as { total: number } | undefined;
  const rows = (sets[1] ?? []) as AuditLogRow[];
  return {
    total: count?.total ?? 0,
    rows: rows.map((row) => ({
      ...row,
      nilai_lama: parseJson(row.nilai_lama),
      nilai_baru: parseJson(row.nilai_baru),
    })),
  };
}
