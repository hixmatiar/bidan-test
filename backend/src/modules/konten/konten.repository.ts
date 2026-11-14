import type { ConnectionPool } from 'mssql';
import sql from 'mssql';
import type { CreateKontenInput, ListKontenFilter, UpdateKontenInput } from './konten.validators';

export interface KontenRow {
  konten_id: string;
  tipe: string;
  judul: string;
  isi: string | null;
  media_url: string | null;
  urutan: number;
  is_published: boolean;
  created_at: Date;
  updated_at: Date | null;
}

interface Param {
  name: string;
  type: sql.ISqlType | (() => sql.ISqlType);
  value: unknown;
}

async function queryPage<T>(
  db: ConnectionPool,
  countSql: string,
  listSql: string,
  params: Param[],
): Promise<{ total: number; rows: T[] }> {
  const request = db.request();
  for (const param of params) request.input(param.name, param.type, param.value);
  const { recordsets } = await request.query(`${countSql};\n${listSql};`);
  const sets = Array.isArray(recordsets) ? recordsets : Object.values(recordsets);
  const count = sets[0]?.[0] as { total: number } | undefined;
  return { total: count?.total ?? 0, rows: (sets[1] ?? []) as T[] };
}

const COLUMNS = `konten_id, tipe, judul, isi, media_url, urutan, is_published, created_at, updated_at`;
// konten_publik has audit trigger; OUTPUT without INTO is disallowed.
const OUT_DECL = `
  DECLARE @out TABLE (
    konten_id UNIQUEIDENTIFIER, tipe VARCHAR(20), judul NVARCHAR(150), isi NVARCHAR(MAX),
    media_url NVARCHAR(500), urutan INT, is_published BIT, created_at DATETIME2(0), updated_at DATETIME2(0)
  );`;

export async function listKonten(
  db: ConnectionPool,
  filter: ListKontenFilter,
  page: number,
  perPage: number,
): Promise<{ rows: KontenRow[]; total: number }> {
  const where: string[] = [];
  const params: Param[] = [
    { name: 'offset', type: sql.Int, value: (page - 1) * perPage },
    { name: 'limit', type: sql.Int, value: perPage },
  ];

  if (filter.tipe) {
    where.push('tipe = @tipe');
    params.push({ name: 'tipe', type: sql.VarChar(20), value: filter.tipe });
  }
  if (filter.is_published !== undefined) {
    where.push('is_published = @is_published');
    params.push({ name: 'is_published', type: sql.Bit, value: filter.is_published ? 1 : 0 });
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return queryPage<KontenRow>(
    db,
    `SELECT COUNT(*) AS total FROM dbo.konten_publik ${whereSql}`,
    `SELECT ${COLUMNS} FROM dbo.konten_publik ${whereSql}
      ORDER BY urutan ASC, created_at ASC, konten_id ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params,
  );
}

export async function createKonten(
  db: ConnectionPool,
  input: CreateKontenInput,
): Promise<KontenRow> {
  const result = await db
    .request()
    .input('tipe', sql.VarChar(20), input.tipe)
    .input('judul', sql.NVarChar(150), input.judul)
    .input('isi', sql.NVarChar(sql.MAX), input.isi ?? null)
    .input('media_url', sql.NVarChar(500), input.media_url ?? null)
    .input('urutan', sql.Int, input.urutan ?? 0)
    .input('is_published', sql.Bit, (input.is_published ?? true) ? 1 : 0)
    .query<KontenRow>(`
      ${OUT_DECL}
      INSERT INTO dbo.konten_publik (tipe, judul, isi, media_url, urutan, is_published)
      OUTPUT INSERTED.${COLUMNS.replace(/, /g, ', INSERTED.')} INTO @out
      VALUES (@tipe, @judul, @isi, @media_url, @urutan, @is_published);
      SELECT ${COLUMNS} FROM @out;
    `);
  return result.recordset[0];
}

export async function updateKonten(
  db: ConnectionPool,
  id: string,
  input: UpdateKontenInput,
): Promise<KontenRow | null> {
  const sets: string[] = [];
  const request = db.request().input('id', sql.UniqueIdentifier, id);

  if (input.tipe !== undefined) {
    sets.push('tipe = @tipe');
    request.input('tipe', sql.VarChar(20), input.tipe);
  }
  if (input.judul !== undefined) {
    sets.push('judul = @judul');
    request.input('judul', sql.NVarChar(150), input.judul);
  }
  if (input.isi !== undefined) {
    sets.push('isi = @isi');
    request.input('isi', sql.NVarChar(sql.MAX), input.isi);
  }
  if (input.media_url !== undefined) {
    sets.push('media_url = @media_url');
    request.input('media_url', sql.NVarChar(500), input.media_url);
  }
  if (input.urutan !== undefined) {
    sets.push('urutan = @urutan');
    request.input('urutan', sql.Int, input.urutan);
  }
  if (input.is_published !== undefined) {
    sets.push('is_published = @is_published');
    request.input('is_published', sql.Bit, input.is_published ? 1 : 0);
  }
  sets.push('updated_at = SYSDATETIME()');

  const result = await request.query<KontenRow>(`
    ${OUT_DECL}
    UPDATE dbo.konten_publik
    SET ${sets.join(', ')}
    OUTPUT INSERTED.${COLUMNS.replace(/, /g, ', INSERTED.')} INTO @out
    WHERE konten_id = @id;
    SELECT ${COLUMNS} FROM @out;
  `);
  return result.recordset[0] ?? null;
}

export async function softDeleteKonten(
  db: ConnectionPool,
  id: string,
): Promise<KontenRow | null> {
  const result = await db
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query<KontenRow>(`
      ${OUT_DECL}
      UPDATE dbo.konten_publik
      SET is_published = 0, updated_at = SYSDATETIME()
      OUTPUT INSERTED.${COLUMNS.replace(/, /g, ', INSERTED.')} INTO @out
      WHERE konten_id = @id AND is_published = 1;
      SELECT ${COLUMNS} FROM @out;
    `);
  return result.recordset[0] ?? null;
}
