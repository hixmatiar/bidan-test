import sql from 'mssql';

type Db = sql.ConnectionPool;

export interface RingkasanRow {
  jumlah_kunjungan: number;
  pasien_baru: number;
  jumlah_reservasi: number;
  total_pendapatan: number;
  tagihan_belum_lunas: number;
}

export async function ringkasan(db: Db, dari: string, sampai: string): Promise<RingkasanRow> {
  const result = await db
    .request()
    .input('dari', sql.Date, dari)
    .input('sampai', sql.Date, sampai)
    .query<RingkasanRow>(`
      DECLARE @d DATE = @dari;
      DECLARE @s DATE = @sampai;
      SELECT
        (SELECT COUNT(*) FROM dbo.kunjungan WHERE CAST(tanggal_kunjungan AS DATE) BETWEEN @d AND @s) AS jumlah_kunjungan,
        (SELECT COUNT(*) FROM dbo.pasien WHERE CAST(created_at AS DATE) BETWEEN @d AND @s) AS pasien_baru,
        (SELECT COUNT(*) FROM dbo.reservasi r JOIN dbo.sesi_praktik sp ON sp.sesi_id = r.sesi_id WHERE sp.tanggal BETWEEN @d AND @s) AS jumlah_reservasi,
        (SELECT CAST(ISNULL(SUM(total_pendapatan), 0) AS DECIMAL(18,2)) FROM dbo.v_rekap_pendapatan WHERE tanggal BETWEEN @d AND @s) AS total_pendapatan,
        (SELECT COUNT(*) FROM dbo.v_tagihan_belum_lunas v WHERE CAST(v.tanggal_kunjungan AS DATE) BETWEEN @d AND @s) AS tagihan_belum_lunas
    `);
  return result.recordset[0];
}

export interface TrenLayananRow {
  periode: string;
  layanan_id: string;
  nama_layanan: string;
  jumlah_kunjungan: number;
}

export async function trenLayanan(
  db: Db,
  dari: string,
  sampai: string,
  grup: 'BULANAN' | 'HARIAN',
): Promise<TrenLayananRow[]> {
  const periodExpr =
    grup === 'BULANAN'
      ? "CONVERT(char(7), CAST(k.tanggal_kunjungan AS DATE), 23)"
      : "CONVERT(char(10), CAST(k.tanggal_kunjungan AS DATE), 23)";
  const result = await db
    .request()
    .input('dari', sql.Date, dari)
    .input('sampai', sql.Date, sampai)
    .query<TrenLayananRow>(`
      SELECT ${periodExpr} AS periode,
             l.layanan_id,
             l.nama AS nama_layanan,
             COUNT(*) AS jumlah_kunjungan
      FROM dbo.kunjungan k
      JOIN dbo.layanan l ON l.layanan_id = k.layanan_id
      WHERE CAST(k.tanggal_kunjungan AS DATE) BETWEEN @dari AND @sampai
      GROUP BY ${periodExpr}, l.layanan_id, l.nama
      ORDER BY periode DESC, jumlah_kunjungan DESC
    `);
  return result.recordset;
}

export interface DiagnosisRow {
  diagnosis: string;
  jumlah: number;
}

export async function topDiagnosis(db: Db, dari: string, sampai: string): Promise<DiagnosisRow[]> {
  const result = await db
    .request()
    .input('dari', sql.Date, dari)
    .input('sampai', sql.Date, sampai)
    .query<DiagnosisRow>(`
      SELECT TOP (10)
             LTRIM(RTRIM(k.diagnosis)) AS diagnosis,
             COUNT(*) AS jumlah
      FROM dbo.kunjungan k
      WHERE CAST(k.tanggal_kunjungan AS DATE) BETWEEN @dari AND @sampai
        AND k.diagnosis IS NOT NULL
        AND LTRIM(RTRIM(k.diagnosis)) <> ''
      GROUP BY LTRIM(RTRIM(k.diagnosis))
      ORDER BY jumlah DESC, diagnosis ASC
    `);
  return result.recordset;
}

export interface JamBucketRow {
  jam: number | null;
  jumlah_reservasi: number;
}

export async function jamTersibuk(db: Db): Promise<JamBucketRow[]> {
  const result = await db.request().query<JamBucketRow>(
    `SELECT jam, jumlah_reservasi FROM dbo.v_jam_tersibuk`,
  );
  return result.recordset;
}

export interface PerbandinganAggRow {
  layanan_id: string;
  nama_layanan: string;
  qty: number;
  revenue: number;
}

export async function perbandinganPerLayanan(
  db: Db,
  dari: string,
  sampai: string,
): Promise<PerbandinganAggRow[]> {
  const result = await db
    .request()
    .input('dari', sql.Date, dari)
    .input('sampai', sql.Date, sampai)
    .query<PerbandinganAggRow>(`
      SELECT l.layanan_id,
             l.nama AS nama_layanan,
             CAST(COUNT(*) AS DECIMAL(18,2)) AS qty,
             CAST(ISNULL(SUM(t.total_tagihan), 0) AS DECIMAL(18,2)) AS revenue
      FROM dbo.kunjungan k
      JOIN dbo.layanan l ON l.layanan_id = k.layanan_id
      LEFT JOIN dbo.tagihan t ON t.kunjungan_id = k.kunjungan_id
      WHERE CAST(k.tanggal_kunjungan AS DATE) BETWEEN @dari AND @sampai
      GROUP BY l.layanan_id, l.nama
    `);
  return result.recordset;
}
