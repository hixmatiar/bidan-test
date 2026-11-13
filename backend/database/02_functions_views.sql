/* ============================================================================
   Praktik Mandiri Bidan - 02_functions_views.sql
   SQL Server 2025
   ----------------------------------------------------------------------------
   Isi   : 4 scalar function + 14 view pelaporan.
   Sifat : idempotent (aman dijalankan berulang) memakai CREATE OR ALTER.
   Catatan:
   - "Hari ini" selalu Asia/Jakarta:
       CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE)
   - Hanya membaca tabel dari 01_schema.sql.
   ============================================================================ */

USE PraktikBidan;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* ============================================================================
   1. fn_hitung_estimasi_jam - jam mulai sesi + (nomor_antrean - 1) * durasi
   NULL bila sesi atau nomor antrean tidak diketahui.
   ============================================================================ */
CREATE OR ALTER FUNCTION dbo.fn_hitung_estimasi_jam
(
    @sesi_id       UNIQUEIDENTIFIER,
    @nomor_antrean INT
)
RETURNS TIME(0)
AS
BEGIN
    DECLARE @hasil TIME(0);

    IF @sesi_id IS NULL OR @nomor_antrean IS NULL OR @nomor_antrean < 1
        RETURN NULL;

    SELECT @hasil = CAST(
               DATEADD(
                   MINUTE,
                   (@nomor_antrean - 1) * s.durasi_per_pasien,
                   CAST(s.jam_mulai AS DATETIME)
               ) AS TIME(0)
           )
    FROM dbo.sesi_praktik AS s
    WHERE s.sesi_id = @sesi_id;

    RETURN @hasil;
END;
GO

/* ============================================================================
   2. fn_status_stok - HABIS / KEDALUWARSA / MENIPIS / AMAN
   Item tidak dikenal dianggap HABIS. Kedaluwarsa dicek sebelum MENIPIS.
   ============================================================================ */
CREATE OR ALTER FUNCTION dbo.fn_status_stok
(
    @item_id UNIQUEIDENTIFIER
)
RETURNS VARCHAR(20)
AS
BEGIN
    DECLARE @stok    DECIMAL(10, 2),
            @minimum DECIMAL(10, 2),
            @expiry  DATE;

    SELECT @stok = i.stok,
           @minimum = i.stok_minimum,
           @expiry = i.tgl_kedaluwarsa
    FROM dbo.item_inventaris AS i
    WHERE i.item_id = @item_id;

    IF @stok IS NULL OR @stok <= 0
        RETURN 'HABIS';

    IF @expiry IS NOT NULL
       AND @expiry < CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE)
        RETURN 'KEDALUWARSA';

    IF @stok <= @minimum
        RETURN 'MENIPIS';

    RETURN 'AMAN';
END;
GO

/* ============================================================================
   3. fn_harga_berlaku - harga terbaru yang berlaku pada @tanggal
   NULL bila tidak ada baris yang cocok (termasuk @tanggal NULL).
   ============================================================================ */
CREATE OR ALTER FUNCTION dbo.fn_harga_berlaku
(
    @ref_tipe VARCHAR(10),
    @ref_id   UNIQUEIDENTIFIER,
    @tanggal  DATE
)
RETURNS DECIMAL(18, 2)
AS
BEGIN
    DECLARE @harga DECIMAL(18, 2);

    IF @ref_tipe IS NULL OR @ref_id IS NULL OR @tanggal IS NULL
        RETURN NULL;

    SELECT TOP (1) @harga = h.harga
    FROM dbo.riwayat_harga AS h
    WHERE h.ref_tipe = @ref_tipe
      AND (
            (h.ref_tipe = 'ITEM'    AND h.item_id = @ref_id)
         OR (h.ref_tipe = 'LAYANAN' AND h.layanan_id = @ref_id)
          )
      AND h.berlaku_dari <= @tanggal
      AND (h.berlaku_sampai IS NULL OR h.berlaku_sampai >= @tanggal)
    ORDER BY h.berlaku_dari DESC, h.created_at DESC;

    RETURN @harga;
END;
GO

/* ============================================================================
   4. fn_cek_alergi - 1 bila pasien punya red-flag ALERGI_OBAT aktif
   ============================================================================ */
CREATE OR ALTER FUNCTION dbo.fn_cek_alergi
(
    @pasien_id UNIQUEIDENTIFIER,
    @item_id   UNIQUEIDENTIFIER
)
RETURNS BIT
AS
BEGIN
    IF @pasien_id IS NULL OR @item_id IS NULL
        RETURN CAST(0 AS BIT);

    RETURN CAST(CASE WHEN EXISTS (
               SELECT 1
               FROM dbo.alergi_kondisi AS a
               WHERE a.pasien_id = @pasien_id
                 AND a.item_id = @item_id
                 AND a.kategori = 'ALERGI_OBAT'
                 AND a.is_active = 1
           ) THEN 1 ELSE 0 END AS BIT);
END;
GO

/* ============================================================================
   5. v_antrean_harian - seluruh antrean sesi pada hari ini (Asia/Jakarta)
   ============================================================================ */
CREATE OR ALTER VIEW dbo.v_antrean_harian
AS
SELECT
    r.reservasi_id,
    r.sesi_id,
    s.tanggal,
    r.nomor_antrean,
    r.estimasi_jam,
    r.status,
    r.metode_daftar,
    r.alasan_batal,
    r.created_at,
    p.pasien_id,
    p.nik,
    p.nama AS nama_pasien,
    p.no_telepon,
    l.layanan_id,
    l.nama AS nama_layanan,
    s.jam_mulai,
    s.jam_selesai,
    s.kuota_maks
FROM dbo.reservasi AS r
JOIN dbo.sesi_praktik AS s ON s.sesi_id = r.sesi_id
JOIN dbo.pasien AS p ON p.pasien_id = r.pasien_id
JOIN dbo.layanan AS l ON l.layanan_id = r.layanan_id
WHERE s.tanggal = CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE);
GO

/* ============================================================================
   6. v_tagihan_belum_lunas - tagihan dengan status BELUM_LUNAS + sisa
   ============================================================================ */
CREATE OR ALTER VIEW dbo.v_tagihan_belum_lunas
AS
SELECT
    t.tagihan_id,
    t.kunjungan_id,
    k.tanggal_kunjungan,
    p.pasien_id,
    p.nik,
    p.nama AS nama_pasien,
    p.no_telepon,
    t.total_tagihan,
    t.total_dibayar,
    CAST(t.total_tagihan - t.total_dibayar AS DECIMAL(18, 2)) AS sisa_tagihan,
    t.status,
    t.created_at
FROM dbo.tagihan AS t
JOIN dbo.kunjungan AS k ON k.kunjungan_id = t.kunjungan_id
JOIN dbo.pasien AS p ON p.pasien_id = k.pasien_id
WHERE t.status = 'BELUM_LUNAS';
GO

/* ============================================================================
   7. v_rekap_pendapatan - pendapatan per tanggal + jalur pembayaran
   ============================================================================ */
CREATE OR ALTER VIEW dbo.v_rekap_pendapatan
AS
SELECT
    CAST(pb.tanggal_bayar AS DATE) AS tanggal,
    pb.jalur,
    COUNT(*) AS jumlah_transaksi,
    CAST(SUM(pb.jumlah) AS DECIMAL(18, 2)) AS total_pendapatan
FROM dbo.pembayaran AS pb
GROUP BY CAST(pb.tanggal_bayar AS DATE), pb.jalur;
GO

/* ============================================================================
   8. v_inventaris_status - item + status stok + sisa hari kedaluwarsa
   ============================================================================ */
CREATE OR ALTER VIEW dbo.v_inventaris_status
AS
SELECT
    i.item_id,
    i.nama,
    i.kategori,
    i.satuan,
    i.stok,
    i.stok_minimum,
    i.tgl_kedaluwarsa,
    DATEDIFF(
        DAY,
        CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE),
        i.tgl_kedaluwarsa
    ) AS days_to_expiry,
    dbo.fn_status_stok(i.item_id) AS status_stok,
    i.is_active,
    i.created_at,
    i.updated_at
FROM dbo.item_inventaris AS i;
GO

/* ============================================================================
   9. v_harga_berlaku - harga berlaku hari ini untuk item dan layanan
   ============================================================================ */
CREATE OR ALTER VIEW dbo.v_harga_berlaku
AS
SELECT
    CAST('ITEM' AS VARCHAR(10)) AS ref_tipe,
    i.item_id AS ref_id,
    i.nama,
    h.harga_id,
    h.harga,
    h.berlaku_dari,
    h.berlaku_sampai
FROM dbo.item_inventaris AS i
OUTER APPLY (
    SELECT TOP (1) h.harga_id, h.harga, h.berlaku_dari, h.berlaku_sampai
    FROM dbo.riwayat_harga AS h
    WHERE h.ref_tipe = 'ITEM'
      AND h.item_id = i.item_id
      AND h.berlaku_dari <= CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE)
      AND (h.berlaku_sampai IS NULL
           OR h.berlaku_sampai >= CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE))
    ORDER BY h.berlaku_dari DESC, h.created_at DESC
) AS h
UNION ALL
SELECT
    CAST('LAYANAN' AS VARCHAR(10)),
    l.layanan_id,
    l.nama,
    h.harga_id,
    h.harga,
    h.berlaku_dari,
    h.berlaku_sampai
FROM dbo.layanan AS l
OUTER APPLY (
    SELECT TOP (1) h.harga_id, h.harga, h.berlaku_dari, h.berlaku_sampai
    FROM dbo.riwayat_harga AS h
    WHERE h.ref_tipe = 'LAYANAN'
      AND h.layanan_id = l.layanan_id
      AND h.berlaku_dari <= CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE)
      AND (h.berlaku_sampai IS NULL
           OR h.berlaku_sampai >= CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE))
    ORDER BY h.berlaku_dari DESC, h.created_at DESC
) AS h;
GO

/* ============================================================================
   10. v_rekap_kunjungan_harian - jumlah kunjungan per tanggal
   ============================================================================ */
CREATE OR ALTER VIEW dbo.v_rekap_kunjungan_harian
AS
SELECT
    CAST(k.tanggal_kunjungan AS DATE) AS tanggal,
    COUNT(*) AS jumlah_kunjungan,
    COUNT(DISTINCT k.pasien_id) AS jumlah_pasien,
    COUNT(DISTINCT k.bidan_id) AS jumlah_bidan
FROM dbo.kunjungan AS k
GROUP BY CAST(k.tanggal_kunjungan AS DATE);
GO

/* ============================================================================
   11. v_tren_layanan - kunjungan + pendapatan per bulan per layanan
   ============================================================================ */
CREATE OR ALTER VIEW dbo.v_tren_layanan
AS
SELECT
    DATEFROMPARTS(YEAR(k.tanggal_kunjungan), MONTH(k.tanggal_kunjungan), 1) AS periode_bulan,
    l.layanan_id,
    l.nama AS nama_layanan,
    COUNT(*) AS jumlah_kunjungan,
    CAST(ISNULL(SUM(t.total_tagihan), 0) AS DECIMAL(18, 2)) AS total_pendapatan
FROM dbo.kunjungan AS k
JOIN dbo.layanan AS l ON l.layanan_id = k.layanan_id
LEFT JOIN dbo.tagihan AS t ON t.kunjungan_id = k.kunjungan_id
GROUP BY
    DATEFROMPARTS(YEAR(k.tanggal_kunjungan), MONTH(k.tanggal_kunjungan), 1),
    l.layanan_id,
    l.nama;
GO

/* ============================================================================
   12. v_jam_tersibuk - histogram jam reservasi 30 hari terakhir
   ============================================================================ */
CREATE OR ALTER VIEW dbo.v_jam_tersibuk
AS
SELECT
    DATEPART(HOUR, r.estimasi_jam) AS jam,
    COUNT(*) AS jumlah_reservasi
FROM dbo.reservasi AS r
JOIN dbo.sesi_praktik AS s ON s.sesi_id = r.sesi_id
WHERE s.tanggal >= DATEADD(
          DAY,
          -30,
          CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE)
      )
  AND s.tanggal <= CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE)
  AND r.status <> 'DIBATALKAN'
GROUP BY DATEPART(HOUR, r.estimasi_jam);
GO

/* ============================================================================
   13. v_penjualan_item_periode - penjualan item per tanggal (dari rincian)
   ============================================================================ */
CREATE OR ALTER VIEW dbo.v_penjualan_item_periode
AS
SELECT
    CAST(k.tanggal_kunjungan AS DATE) AS tanggal,
    tr.item_id,
    i.nama AS nama_item,
    i.satuan,
    CAST(SUM(tr.qty) AS DECIMAL(18, 2)) AS total_qty,
    CAST(SUM(tr.subtotal) AS DECIMAL(18, 2)) AS total_penjualan,
    COUNT(DISTINCT tr.tagihan_id) AS jumlah_transaksi
FROM dbo.tagihan_rincian AS tr
JOIN dbo.tagihan AS t ON t.tagihan_id = tr.tagihan_id
JOIN dbo.kunjungan AS k ON k.kunjungan_id = t.kunjungan_id
JOIN dbo.item_inventaris AS i ON i.item_id = tr.item_id
WHERE tr.item_id IS NOT NULL
GROUP BY
    CAST(k.tanggal_kunjungan AS DATE),
    tr.item_id,
    i.nama,
    i.satuan;
GO

/* ============================================================================
   14. v_audit_log_detail - audit_logs + username pelaku
   ============================================================================ */
CREATE OR ALTER VIEW dbo.v_audit_log_detail
AS
SELECT
    a.log_id,
    a.user_id,
    COALESCE(u.username, a.user_ref) AS username,
    a.aksi,
    a.entitas,
    a.entitas_id,
    a.nilai_lama,
    a.nilai_baru,
    a.ip_address,
    a.created_at
FROM dbo.audit_logs AS a
LEFT JOIN dbo.users AS u ON u.user_id = a.user_id;
GO

/* ============================================================================
   15. v_sesi_sisa_kuota - kuota maks dikurangi reservasi aktif
   ============================================================================ */
CREATE OR ALTER VIEW dbo.v_sesi_sisa_kuota
AS
SELECT
    s.sesi_id,
    s.tanggal,
    s.jam_mulai,
    s.jam_selesai,
    s.kuota_maks,
    s.durasi_per_pasien,
    s.is_active,
    COUNT(r.reservasi_id) AS terpakai,
    s.kuota_maks - COUNT(r.reservasi_id) AS sisa_kuota
FROM dbo.sesi_praktik AS s
LEFT JOIN dbo.reservasi AS r
       ON r.sesi_id = s.sesi_id
      AND r.status <> 'DIBATALKAN'
GROUP BY
    s.sesi_id,
    s.tanggal,
    s.jam_mulai,
    s.jam_selesai,
    s.kuota_maks,
    s.durasi_per_pasien,
    s.is_active;
GO

/* ============================================================================
   16. v_profil_rme - profil pasien + statistik kunjungan + red-flag aktif
   ============================================================================ */
CREATE OR ALTER VIEW dbo.v_profil_rme
AS
SELECT
    p.pasien_id,
    p.nik,
    p.nama,
    p.tgl_lahir,
    p.alamat,
    p.no_telepon,
    p.is_active,
    p.created_at,
    p.updated_at,
    ISNULL(k.jumlah_kunjungan, 0) AS jumlah_kunjungan,
    k.kunjungan_terakhir,
    ISNULL(a.jumlah_red_flag, 0) AS jumlah_red_flag_aktif
FROM dbo.pasien AS p
OUTER APPLY (
    SELECT
        COUNT(*) AS jumlah_kunjungan,
        MAX(k.tanggal_kunjungan) AS kunjungan_terakhir
    FROM dbo.kunjungan AS k
    WHERE k.pasien_id = p.pasien_id
) AS k
OUTER APPLY (
    SELECT COUNT(*) AS jumlah_red_flag
    FROM dbo.alergi_kondisi AS a
    WHERE a.pasien_id = p.pasien_id
      AND a.is_active = 1
) AS a;
GO

/* ============================================================================
   17. v_tagihan_detail - tagihan + rincian + total dibayar + sisa
   ============================================================================ */
CREATE OR ALTER VIEW dbo.v_tagihan_detail
AS
SELECT
    t.tagihan_id,
    t.kunjungan_id,
    k.tanggal_kunjungan,
    p.pasien_id,
    p.nama AS nama_pasien,
    tr.rincian_id,
    CASE WHEN tr.item_id IS NOT NULL THEN 'ITEM' ELSE 'LAYANAN' END AS tipe,
    COALESCE(i.nama, l.nama) AS nama_baris,
    tr.qty,
    tr.harga_satuan,
    tr.subtotal,
    t.total_tagihan,
    t.total_dibayar,
    CAST(t.total_tagihan - t.total_dibayar AS DECIMAL(18, 2)) AS sisa_tagihan,
    t.status
FROM dbo.tagihan AS t
JOIN dbo.kunjungan AS k ON k.kunjungan_id = t.kunjungan_id
JOIN dbo.pasien AS p ON p.pasien_id = k.pasien_id
LEFT JOIN dbo.tagihan_rincian AS tr ON tr.tagihan_id = t.tagihan_id
LEFT JOIN dbo.item_inventaris AS i ON i.item_id = tr.item_id
LEFT JOIN dbo.layanan AS l ON l.layanan_id = tr.layanan_id;
GO

/* ============================================================================
   18. v_riwayat_stok_item - mutasi stok + nama item + username
   ============================================================================ */
CREATE OR ALTER VIEW dbo.v_riwayat_stok_item
AS
SELECT
    rs.riwayat_id,
    rs.item_id,
    i.nama AS nama_item,
    i.satuan,
    rs.kunjungan_id,
    rs.user_id,
    COALESCE(u.username, u.nama_lengkap) AS username,
    rs.jenis,
    rs.jumlah,
    rs.keterangan,
    rs.tanggal
FROM dbo.riwayat_stok AS rs
JOIN dbo.item_inventaris AS i ON i.item_id = rs.item_id
LEFT JOIN dbo.users AS u ON u.user_id = rs.user_id;
GO
