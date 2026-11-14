import sql from 'mssql';

type Db = sql.ConnectionPool;

export interface RekapPendapatanRow {
  periode: string;
  jumlah_transaksi: number;
  total_pendapatan: number;
}

export async function rekapPendapatan(
  db: Db,
  params: {
    dari: string;
    sampai: string;
    grup: 'HARIAN' | 'BULANAN';
  },
): Promise<RekapPendapatanRow[]> {
  const periodExpression =
    params.grup === 'BULANAN'
      ? "CONVERT(char(7), tanggal, 23)"
      : "CONVERT(char(10), tanggal, 23)";

  const result = await db
    .request()
    .input('dari', sql.Date, params.dari)
    .input('sampai', sql.Date, params.sampai)
    .query<RekapPendapatanRow>(`
      SELECT ${periodExpression} AS periode,
             SUM(jumlah_transaksi) AS jumlah_transaksi,
             CAST(SUM(total_pendapatan) AS DECIMAL(18, 2)) AS total_pendapatan
      FROM dbo.v_rekap_pendapatan
      WHERE tanggal BETWEEN @dari AND @sampai
      GROUP BY ${periodExpression}
      ORDER BY periode
    `);

  return result.recordset;
}
