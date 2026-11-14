import sql from 'mssql';

type Db = sql.ConnectionPool;

export interface CekPasienRow {
  pasien_id: string;
  nama: string;
  has_red_flag: boolean;
}

export interface PasienIdentityRow {
  pasien_id: string;
  nik: string;
  nama: string;
  tgl_lahir: string;
  alamat: string | null;
  no_telepon: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
}

interface SearchInput {
  nik?: string;
  noTelepon?: string;
}

export async function findByNikOrPhone(
  db: Db,
  input: SearchInput,
): Promise<CekPasienRow | null> {
  const request = db.request();
  const condition =
    input.nik !== undefined ? 'p.nik = @nik' : 'p.no_telepon = @no_telepon';

  if (input.nik !== undefined) {
    request.input('nik', sql.Char(16), input.nik);
  } else {
    request.input('no_telepon', sql.NVarChar(20), input.noTelepon ?? null);
  }

  const result = await request.query<CekPasienRow>(`
    SELECT p.pasien_id, p.nama,
           CAST(CASE WHEN EXISTS (
             SELECT 1
             FROM dbo.alergi_kondisi AS a
             WHERE a.pasien_id = p.pasien_id
               AND a.is_active = 1
           ) THEN 1 ELSE 0 END AS BIT) AS has_red_flag
    FROM dbo.pasien AS p
    WHERE p.is_active = 1
      AND ${condition}
  `);

  return result.recordset[0] ?? null;
}

function bindFilter(
  request: sql.Request,
  filter: { q?: string; is_active?: boolean },
): sql.Request {
  if (filter.q) {
    request.input('q', sql.NVarChar(100), filter.q);
  }
  if (filter.is_active !== undefined) {
    request.input('is_active', sql.Bit, filter.is_active);
  }
  return request;
}

function whereClause(filter: { q?: string; is_active?: boolean }): string {
  const clauses: string[] = [];

  if (filter.q) {
    clauses.push(`(
      p.nama LIKE N'%' + @q + N'%'
      OR p.nik LIKE @q + N'%'
      OR p.no_telepon LIKE N'%' + @q + N'%'
    )`);
  }
  if (filter.is_active !== undefined) {
    clauses.push('p.is_active = @is_active');
  }

  return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
}

const SELECT_COLUMNS = `
  p.pasien_id,
  p.nik,
  p.nama,
  CONVERT(char(10), p.tgl_lahir, 23) AS tgl_lahir,
  p.alamat,
  p.no_telepon,
  p.is_active,
  p.created_at,
  p.updated_at
`;

export async function listIdentitas(
  db: Db,
  filter: { q?: string; is_active?: boolean },
  page: number,
  perPage: number,
): Promise<{ rows: PasienIdentityRow[]; total: number }> {
  const where = whereClause(filter);
  const offset = (page - 1) * perPage;

  const countResult = await bindFilter(db.request(), filter).query<{ total: number }>(`
    SELECT COUNT(*) AS total
    FROM dbo.pasien AS p
    ${where}
  `);

  const rowsResult = await bindFilter(db.request(), filter)
    .input('offset', sql.Int, offset)
    .input('per_page', sql.Int, perPage)
    .query<PasienIdentityRow>(`
      SELECT ${SELECT_COLUMNS}
      FROM dbo.pasien AS p
      ${where}
      ORDER BY p.nama ASC, p.pasien_id ASC
      OFFSET @offset ROWS FETCH NEXT @per_page ROWS ONLY
    `);

  return {
    rows: rowsResult.recordset,
    total: countResult.recordset[0]?.total ?? 0,
  };
}
