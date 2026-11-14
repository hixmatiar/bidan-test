import sql from 'mssql';
import { AppError } from '@/utils/errors';
import type { ListTagihanFilters } from './tagihan.validators';

type Db = sql.ConnectionPool;

export type TagihanStatus = 'LUNAS' | 'BELUM_LUNAS';

export interface TagihanDetailRow {
  tagihan_id: string;
  kunjungan_id: string;
  tanggal_kunjungan: Date;
  pasien_id: string;
  nama_pasien: string;
  rincian_id: string | null;
  tipe: 'ITEM' | 'LAYANAN' | null;
  nama_baris: string | null;
  qty: number | null;
  harga_satuan: number | null;
  subtotal: number | null;
  total_tagihan: number;
  total_dibayar: number;
  sisa_tagihan: number;
  status: TagihanStatus;
}

export interface PembayaranRow {
  pembayaran_id: string;
  tagihan_id: string;
  jumlah: number;
  jalur: 'MANDIRI' | 'BPJS' | 'ASURANSI';
  dicatat_oleh: string | null;
  dicatat_oleh_username: string | null;
  tanggal_bayar: Date;
}

export interface TagihanListRow {
  tagihan_id: string;
  kunjungan_id: string;
  tanggal_kunjungan: Date;
  pasien_id: string;
  nik: string;
  nama_pasien: string;
  total_tagihan: number;
  total_dibayar: number;
  sisa_tagihan: number;
  status: TagihanStatus;
  created_at: Date;
  updated_at: Date | null;
}

export interface PembayaranResult {
  tagihan_id: string;
  total_tagihan: number;
  total_dibayar: number;
  status: TagihanStatus;
}

export async function findDetailByKunjungan(
  db: Db,
  kunjunganId: string,
): Promise<TagihanDetailRow[]> {
  const result = await db
    .request()
    .input('kunjungan_id', sql.UniqueIdentifier, kunjunganId)
    .query<TagihanDetailRow>(`
      SELECT tagihan_id, kunjungan_id, tanggal_kunjungan, pasien_id, nama_pasien,
             rincian_id, tipe, nama_baris, qty, harga_satuan, subtotal,
             total_tagihan, total_dibayar, sisa_tagihan, status
      FROM dbo.v_tagihan_detail
      WHERE kunjungan_id = @kunjungan_id
      ORDER BY rincian_id
    `);

  return result.recordset;
}

export async function listPembayaran(
  db: Db,
  tagihanId: string,
): Promise<PembayaranRow[]> {
  const result = await db
    .request()
    .input('tagihan_id', sql.UniqueIdentifier, tagihanId)
    .query<PembayaranRow>(`
      SELECT p.pembayaran_id, p.tagihan_id, p.jumlah, p.jalur,
             p.dicatat_oleh, u.username AS dicatat_oleh_username,
             p.tanggal_bayar
      FROM dbo.pembayaran AS p
      LEFT JOIN dbo.users AS u ON u.user_id = p.dicatat_oleh
      WHERE p.tagihan_id = @tagihan_id
      ORDER BY p.tanggal_bayar, p.pembayaran_id
    `);

  return result.recordset;
}

const LIST_FROM = `
  FROM dbo.tagihan AS t
  INNER JOIN dbo.kunjungan AS k ON k.kunjungan_id = t.kunjungan_id
  INNER JOIN dbo.pasien AS p ON p.pasien_id = k.pasien_id
`;

const LIST_WHERE = `
  WHERE (@status IS NULL OR t.status = @status)
    AND (@pasien_id IS NULL OR k.pasien_id = @pasien_id)
    AND (@tanggal_dari IS NULL OR CAST(k.tanggal_kunjungan AS DATE) >= @tanggal_dari)
    AND (@tanggal_sampai IS NULL OR CAST(k.tanggal_kunjungan AS DATE) <= @tanggal_sampai)
    AND (
      @q IS NULL
      OR p.nama LIKE N'%' + @q + N'%'
      OR p.nik LIKE @q + '%'
    )
`;

export async function listTagihan(
  db: Db,
  filters: ListTagihanFilters,
  page: number,
  perPage: number,
): Promise<{ rows: TagihanListRow[]; total: number }> {
  const offset = (page - 1) * perPage;
  const request = db
    .request()
    .input('status', sql.VarChar(20), filters.status ?? null)
    .input('pasien_id', sql.UniqueIdentifier, filters.pasien_id ?? null)
    .input('tanggal_dari', sql.Date, filters.tanggal_dari ?? null)
    .input('tanggal_sampai', sql.Date, filters.tanggal_sampai ?? null)
    .input(
      'q',
      sql.NVarChar(100),
      filters.q && filters.q.length > 0 ? filters.q : null,
    );

  const countResult = await request.query<{ total: number }>(
    `SELECT COUNT(*) AS total ${LIST_FROM} ${LIST_WHERE}`,
  );

  const rowsResult = await db
    .request()
    .input('status', sql.VarChar(20), filters.status ?? null)
    .input('pasien_id', sql.UniqueIdentifier, filters.pasien_id ?? null)
    .input('tanggal_dari', sql.Date, filters.tanggal_dari ?? null)
    .input('tanggal_sampai', sql.Date, filters.tanggal_sampai ?? null)
    .input(
      'q',
      sql.NVarChar(100),
      filters.q && filters.q.length > 0 ? filters.q : null,
    )
    .input('offset', sql.Int, offset)
    .input('per_page', sql.Int, perPage)
    .query<TagihanListRow>(`
      SELECT t.tagihan_id, t.kunjungan_id, k.tanggal_kunjungan,
             p.pasien_id, p.nik, p.nama AS nama_pasien,
             t.total_tagihan, t.total_dibayar,
             CAST(t.total_tagihan - t.total_dibayar AS DECIMAL(18, 2)) AS sisa_tagihan,
             t.status, t.created_at, t.updated_at
      ${LIST_FROM}
      ${LIST_WHERE}
      ORDER BY k.tanggal_kunjungan DESC, t.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @per_page ROWS ONLY
    `);

  return {
    rows: rowsResult.recordset,
    total: countResult.recordset[0]?.total ?? 0,
  };
}

export async function catatPembayaranViaSp(
  db: Db,
  params: {
    tagihanId: string;
    jumlah: number;
    jalur: 'MANDIRI' | 'BPJS' | 'ASURANSI';
    dicatatOleh: string;
    ip: string | null;
  },
): Promise<PembayaranResult> {
  const result = await db
    .request()
    .input('tagihan_id', sql.UniqueIdentifier, params.tagihanId)
    .input('jumlah', sql.Decimal(18, 2), params.jumlah)
    .input('jalur', sql.VarChar(20), params.jalur)
    .input('dicatat_oleh', sql.UniqueIdentifier, params.dicatatOleh)
    .input('ip', sql.VarChar(45), params.ip ?? '')
    .execute<PembayaranResult>('dbo.sp_catat_pembayaran');

  const row = result.recordset[0];
  if (!row) {
    throw new AppError('ERR-SYS-02');
  }

  return row;
}
