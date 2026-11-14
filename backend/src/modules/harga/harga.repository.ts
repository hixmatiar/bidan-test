import type { ConnectionPool } from 'mssql';
import sql from 'mssql';
import { AppError } from '@/utils/errors';
import type { ListHargaFilter, RiwayatListParams, UbahHargaInput } from './harga.validators';

export interface HargaListRow {
  ref_tipe: string;
  ref_id: string;
  nama: string;
  // v_harga_berlaku uses OUTER APPLY, so a master row without a price yields NULLs.
  harga_id: string | null;
  harga: number | null;
  berlaku_dari: Date | null;
  berlaku_sampai: Date | null;
}

export interface HargaRiwayatRow {
  harga_id: string;
  ref_tipe: string;
  item_id: string | null;
  layanan_id: string | null;
  harga: number;
  berlaku_dari: Date;
  berlaku_sampai: Date | null;
  alasan: string | null;
  diubah_oleh: string | null;
  created_at: Date;
}

export interface UbahHargaResult {
  harga_id: string;
  berlaku_dari: Date;
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

export async function listHarga(
  db: ConnectionPool,
  filter: ListHargaFilter,
  page: number,
  perPage: number,
): Promise<{ rows: HargaListRow[]; total: number }> {
  const where: string[] = [];
  const params: Param[] = [];

  if (filter.ref_tipe) {
    where.push('ref_tipe = @ref_tipe');
    params.push({ name: 'ref_tipe', type: sql.VarChar(10), value: filter.ref_tipe });
  }
  if (filter.q) {
    where.push('nama LIKE @q');
    params.push({ name: 'q', type: sql.NVarChar(102), value: `%${filter.q}%` });
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const listSql = `
    SELECT ref_tipe, ref_id, nama, harga_id, harga, berlaku_dari, berlaku_sampai
    FROM dbo.v_harga_berlaku
    ${whereSql}
    ORDER BY ref_tipe ASC, nama ASC, ref_id ASC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
  const countSql = `
    SELECT COUNT(*) AS total
    FROM dbo.v_harga_berlaku
    ${whereSql}`;

  const { total, rows } = await queryPage<HargaListRow>(
    db,
    countSql,
    listSql,
    [
      ...params,
      { name: 'offset', type: sql.Int, value: (page - 1) * perPage },
      { name: 'limit', type: sql.Int, value: perPage },
    ],
  );

  return { rows, total };
}

export async function listRiwayatHarga(
  db: ConnectionPool,
  params: RiwayatListParams,
  page: number,
  perPage: number,
): Promise<{ rows: HargaRiwayatRow[]; total: number }> {
  const whereSql = `
    WHERE ref_tipe = @ref_tipe
      AND (
        (@ref_tipe = 'ITEM' AND item_id = @ref_id)
        OR (@ref_tipe = 'LAYANAN' AND layanan_id = @ref_id)
      )`;
  const columns = `
    harga_id, ref_tipe, item_id, layanan_id, harga, berlaku_dari, berlaku_sampai,
    alasan, diubah_oleh, created_at`;

  const { total, rows } = await queryPage<HargaRiwayatRow>(
    db,
    `SELECT COUNT(*) AS total FROM dbo.riwayat_harga ${whereSql}`,
    `SELECT ${columns}
    FROM dbo.riwayat_harga
    ${whereSql}
    ORDER BY berlaku_dari DESC, created_at DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    [
      { name: 'ref_tipe', type: sql.VarChar(10), value: params.ref_tipe },
      { name: 'ref_id', type: sql.UniqueIdentifier, value: params.ref_id },
      { name: 'offset', type: sql.Int, value: (page - 1) * perPage },
      { name: 'limit', type: sql.Int, value: perPage },
    ],
  );

  return { rows, total };
}

export async function ubahHarga(
  db: ConnectionPool,
  refTipe: string,
  refId: string,
  input: UbahHargaInput,
  userId: string | null,
  ip: string | null,
): Promise<UbahHargaResult> {
  // berlaku_dari stays a 'YYYY-MM-DD' string: SQL Server parses that ISO form
  // into the DATE parameter deterministically, so no timezone day shift can occur.
  const result = await db
    .request()
    .input('ref_tipe', sql.VarChar(10), refTipe)
    .input('ref_id', sql.UniqueIdentifier, refId)
    .input('harga', sql.Decimal(18, 2), input.harga)
    .input('berlaku_dari', sql.VarChar(10), input.berlaku_dari)
    .input('alasan', sql.NVarChar(255), input.alasan ?? null)
    .input('diubah_oleh', sql.UniqueIdentifier, userId)
    .input('ip', sql.NVarChar(45), ip)
    .execute('sp_ubah_harga');

  const rows = result.recordset as UbahHargaResult[];
  if (rows.length === 0) {
    throw new AppError('ERR-SYS-02');
  }
  return rows[0];
}
