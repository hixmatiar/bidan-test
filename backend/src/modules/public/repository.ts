import sql from 'mssql';
import type { ConnectionPool } from 'mssql';
import type { KontenListParams, LayananListParams, SesiListParams } from './validators';

export interface KontenPublicRow {
  konten_id: string;
  tipe: string;
  judul: string;
  isi: string | null;
  media_url: string | null;
  urutan: number;
}

export interface LayananPublicRow {
  layanan_id: string;
  nama: string;
  kategori: string;
  deskripsi: string | null;
}

export interface SesiPublicRow {
  sesi_id: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  kuota_maks: number;
  sisa_kuota: number;
}

interface Param {
  name: string;
  type: sql.ISqlType | (() => sql.ISqlType);
  value: unknown;
}

// ponytail: count + page share one batch so a list costs a single round trip.
async function queryPage<T>(
  db: ConnectionPool,
  countSql: string,
  listSql: string,
  params: Param[],
): Promise<{ total: number; rows: T[] }> {
  const request = db.request();
  for (const param of params) {
    request.input(param.name, param.type, param.value);
  }
  const { recordsets } = await request.query(`${countSql};\n${listSql};`);
  const sets = Array.isArray(recordsets)
    ? recordsets
    : Object.values(recordsets);
  const count = sets[0]?.[0] as { total: number } | undefined;
  return { total: count?.total ?? 0, rows: (sets[1] ?? []) as T[] };
}

function pageParams(page: number, perPage: number): Param[] {
  return [
    { name: 'offset', type: sql.Int, value: (page - 1) * perPage },
    { name: 'limit', type: sql.Int, value: perPage },
  ];
}

const KONTEN_COLUMNS = 'konten_id, tipe, judul, isi, media_url, urutan';

export async function listKonten(
  db: ConnectionPool,
  filter: KontenListParams,
): Promise<{ total: number; rows: KontenPublicRow[] }> {
  const where = ['is_published = 1'];
  const params = pageParams(filter.current_page, filter.per_page);

  if (filter.tipe) {
    where.push('tipe = @tipe');
    params.push({ name: 'tipe', type: sql.VarChar(20), value: filter.tipe });
  }

  const whereSql = where.join(' AND ');
  return queryPage<KontenPublicRow>(
    db,
    `SELECT COUNT(*) AS total FROM dbo.konten_publik WHERE ${whereSql}`,
    `SELECT ${KONTEN_COLUMNS} FROM dbo.konten_publik WHERE ${whereSql}
      ORDER BY urutan ASC, konten_id ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params,
  );
}

const LAYANAN_COLUMNS = 'layanan_id, nama, kategori, deskripsi';

export async function listLayanan(
  db: ConnectionPool,
  filter: LayananListParams,
): Promise<{ total: number; rows: LayananPublicRow[] }> {
  const where = ['is_active = 1'];
  const params = pageParams(filter.current_page, filter.per_page);

  if (filter.kategori) {
    where.push('kategori = @kategori');
    params.push({ name: 'kategori', type: sql.VarChar(20), value: filter.kategori });
  }

  const whereSql = where.join(' AND ');
  return queryPage<LayananPublicRow>(
    db,
    `SELECT COUNT(*) AS total FROM dbo.layanan WHERE ${whereSql}`,
    `SELECT ${LAYANAN_COLUMNS} FROM dbo.layanan WHERE ${whereSql}
      ORDER BY nama ASC, layanan_id ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params,
  );
}

const SESI_COLUMNS = `sesi_id,
  CONVERT(VARCHAR(10), tanggal, 23) AS tanggal,
  CONVERT(VARCHAR(8), jam_mulai, 108) AS jam_mulai,
  CONVERT(VARCHAR(8), jam_selesai, 108) AS jam_selesai,
  kuota_maks,
  sisa_kuota`;

export async function listSesi(
  db: ConnectionPool,
  filter: SesiListParams,
  today: string,
): Promise<{ total: number; rows: SesiPublicRow[] }> {
  const where = ['is_active = 1', 'tanggal >= CONVERT(DATE, @today, 23)'];
  const params = pageParams(filter.current_page, filter.per_page);
  params.push({ name: 'today', type: sql.VarChar(10), value: today });
  params.push({
    name: 'tanggal_dari',
    type: sql.VarChar(10),
    value: filter.tanggal_dari ?? null,
  });
  params.push({
    name: 'tanggal_sampai',
    type: sql.VarChar(10),
    value: filter.tanggal_sampai ?? null,
  });

  where.push(
    '(@tanggal_dari IS NULL OR tanggal >= CONVERT(DATE, @tanggal_dari, 23))',
  );
  where.push(
    '(@tanggal_sampai IS NULL OR tanggal <= CONVERT(DATE, @tanggal_sampai, 23))',
  );

  const whereSql = where.join(' AND ');
  return queryPage<SesiPublicRow>(
    db,
    `SELECT COUNT(*) AS total FROM dbo.v_sesi_sisa_kuota WHERE ${whereSql}`,
    `SELECT ${SESI_COLUMNS} FROM dbo.v_sesi_sisa_kuota WHERE ${whereSql}
      ORDER BY tanggal ASC, jam_mulai ASC, sesi_id ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params,
  );
}
