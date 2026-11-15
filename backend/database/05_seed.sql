/* ============================================================================
   Praktik Mandiri Bidan - 05_seed.sql
   SQL Server 2025
   ----------------------------------------------------------------------------
   Isi   : data awal (2 user internal, master layanan + harga, master
           inventaris + harga, 5 sesi praktik, 5 konten publik).
   Sifat : idempotent - setiap baris dijaga IF NOT EXISTS pada natural key:
             users             -> username
             layanan           -> nama
             item_inventaris   -> nama + satuan
             konten_publik     -> tipe + judul
             sesi_praktik      -> tanggal + jam_mulai
             riwayat_harga     -> baris terbuka (berlaku_sampai IS NULL)
   Tidak mengisi reservasi, kunjungan, pembayaran, maupun audit_logs.
   Kolom password_hash diisi hash bcrypt cost 12 yang dibuat di luar skrip;
   tidak ada kata sandi mentah di berkas ini.
   ============================================================================ */

USE PraktikBidan;
GO

SET NOCOUNT ON;
GO

/* Konteks sesi untuk trigger audit (seed dianggap sistem, tanpa aktor). */
EXEC sp_set_session_context @key = N'user_id', @value = NULL;
EXEC sp_set_session_context @key = N'ip', @value = N'127.0.0.1';
GO

DECLARE @hari_ini DATE = CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE);

/* ============================================================================
   1. users - satu BIDAN dan satu ADMIN, hash berbeda
   ============================================================================ */
INSERT INTO dbo.users (username, password_hash, nama_lengkap, role, no_telepon)
SELECT v.username, v.password_hash, v.nama_lengkap, v.role, v.no_telepon
FROM (VALUES
    (N'bidan', N'$2b$12$GOOZ6X6nsASQcDHJdK6JnOGvgNOrhtv9wqZ2MGuj/yHQwhhUrC5MG',
     N'Bdn. Ria Indrasti J., S.Keb', 'BIDAN', N'081234567801'),
    (N'admin', N'$2b$12$3ZkOUaNBEfyEY/xZhijKpOn8ks4MhQ6K2AX2rn6aThQ9d.EUyxKD6',
     N'Admin Praktik Bidan', 'ADMIN', N'081234567802')
) AS v (username, password_hash, nama_lengkap, role, no_telepon)
WHERE NOT EXISTS (SELECT 1 FROM dbo.users AS u WHERE u.username = v.username);

/* ============================================================================
   2. layanan - campuran KEBIDANAN dan UMUM
   ============================================================================ */
INSERT INTO dbo.layanan (nama, kategori, deskripsi)
SELECT v.nama, v.kategori, v.deskripsi
FROM (VALUES
    (N'Pemeriksaan Kehamilan (ANC)', 'KEBIDANAN', N'Pemeriksaan rutin ibu hamil termasuk pemeriksaan fisik dan konsultasi.'),
    (N'Persalinan Normal',           'KEBIDANAN', N'Pertolongan persalinan normal beserta perawatan ibu dan bayi baru lahir.'),
    (N'Pemeriksaan Nifas',           'KEBIDANAN', N'Pemantauan kesehatan ibu dan involusi rahim pada masa nifas.'),
    (N'Pelayanan KB',                'KEBIDANAN', N'Konsultasi dan pemasangan alat kontrasepsi.'),
    (N'Imunisasi Bayi',              'KEBIDANAN', N'Imunisasi dasar lengkap sesuai jadwal.'),
    (N'Senam Hamil',                 'KEBIDANAN', N'Senam hamil terpandu untuk kebugaran ibu selama kehamilan.'),
    (N'Pemeriksaan Umum',            'UMUM',      N'Pemeriksaan kesehatan umum dan konsultasi keluhan ringan.'),
    (N'Konsultasi Gizi',             'UMUM',      N'Konsultasi gizi ibu hamil, menyusui, dan anak.')
) AS v (nama, kategori, deskripsi)
WHERE NOT EXISTS (SELECT 1 FROM dbo.layanan AS l WHERE l.nama = v.nama);

/* ============================================================================
   3. item_inventaris - campuran OBAT dan PRODUK_KESEHATAN
   Betadine sengaja di bawah stok_minimum; Amoxicillin kedaluwarsa < 3 bulan.
   ============================================================================ */
INSERT INTO dbo.item_inventaris (nama, kategori, satuan, stok, stok_minimum, tgl_kedaluwarsa)
SELECT v.nama, v.kategori, v.satuan, v.stok, v.stok_minimum, v.tgl_kedaluwarsa
FROM (VALUES
    (N'Tablet Tambah Darah',      'OBAT',              N'tablet',  120.00, 30.00, CAST(NULL AS DATE)),
    (N'Asam Folat 400 mcg',       'OBAT',              N'tablet',   80.00, 20.00, CAST(NULL AS DATE)),
    (N'Kalsium Laktat 500 mg',    'OBAT',              N'tablet',   60.00, 20.00, CAST(NULL AS DATE)),
    (N'Paracetamol 500 mg',       'OBAT',              N'tablet',  200.00, 50.00, CAST(NULL AS DATE)),
    (N'Amoxicillin 500 mg',       'OBAT',              N'kapsul',   40.00, 20.00, DATEADD(MONTH, 2, @hari_ini)),
    (N'Oksitosin 10 IU',          'OBAT',              N'ampul',    15.00,  5.00, CAST(NULL AS DATE)),
    (N'Betadine 60 ml',           'PRODUK_KESEHATAN',  N'botol',     2.00,  5.00, CAST(NULL AS DATE)),
    (N'Alkohol 70% 100 ml',       'PRODUK_KESEHATAN',  N'botol',    24.00,  6.00, CAST(NULL AS DATE)),
    (N'Kapas 100 gram',           'PRODUK_KESEHATAN',  N'bungkus',  30.00, 10.00, CAST(NULL AS DATE)),
    (N'Handscoon Steril',         'PRODUK_KESEHATAN',  N'pasang',  150.00, 40.00, CAST(NULL AS DATE))
) AS v (nama, kategori, satuan, stok, stok_minimum, tgl_kedaluwarsa)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.item_inventaris AS i
    WHERE i.nama = v.nama AND i.satuan = v.satuan
);

/* ============================================================================
   4. riwayat_harga - satu harga terbuka untuk setiap layanan
   ============================================================================ */
INSERT INTO dbo.riwayat_harga (ref_tipe, layanan_id, harga, berlaku_dari, alasan)
SELECT 'LAYANAN', l.layanan_id, v.harga, @hari_ini, N'Harga awal seed'
FROM (VALUES
    (N'Pemeriksaan Kehamilan (ANC)', 75000.00),
    (N'Persalinan Normal',          1500000.00),
    (N'Pemeriksaan Nifas',           60000.00),
    (N'Pelayanan KB',                50000.00),
    (N'Imunisasi Bayi',              45000.00),
    (N'Senam Hamil',                 40000.00),
    (N'Pemeriksaan Umum',            50000.00),
    (N'Konsultasi Gizi',             60000.00)
) AS v (nama, harga)
JOIN dbo.layanan AS l ON l.nama = v.nama
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.riwayat_harga AS h
    WHERE h.layanan_id = l.layanan_id AND h.berlaku_sampai IS NULL
);

/* ============================================================================
   5. riwayat_harga - satu harga terbuka untuk setiap item inventaris
   ============================================================================ */
INSERT INTO dbo.riwayat_harga (ref_tipe, item_id, harga, berlaku_dari, alasan)
SELECT 'ITEM', i.item_id, v.harga, @hari_ini, N'Harga awal seed'
FROM (VALUES
    (N'Tablet Tambah Darah',     N'tablet',   2500.00),
    (N'Asam Folat 400 mcg',      N'tablet',   2000.00),
    (N'Kalsium Laktat 500 mg',   N'tablet',   3000.00),
    (N'Paracetamol 500 mg',      N'tablet',   1500.00),
    (N'Amoxicillin 500 mg',      N'kapsul',   4000.00),
    (N'Oksitosin 10 IU',         N'ampul',   25000.00),
    (N'Betadine 60 ml',          N'botol',   35000.00),
    (N'Alkohol 70% 100 ml',      N'botol',   18000.00),
    (N'Kapas 100 gram',          N'bungkus', 12000.00),
    (N'Handscoon Steril',        N'pasang',   3500.00)
) AS v (nama, satuan, harga)
JOIN dbo.item_inventaris AS i ON i.nama = v.nama AND i.satuan = v.satuan
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.riwayat_harga AS h
    WHERE h.item_id = i.item_id AND h.berlaku_sampai IS NULL
);

/* ============================================================================
   6. sesi_praktik - lima hari ke depan, 08:00-12:00, durasi 15 menit
   ============================================================================ */
INSERT INTO dbo.sesi_praktik (tanggal, jam_mulai, jam_selesai, kuota_maks, durasi_per_pasien)
SELECT DATEADD(DAY, v.hari, @hari_ini), CAST('08:00' AS TIME(0)), CAST('12:00' AS TIME(0)), v.kuota, 15
FROM (VALUES
    (1, 12),
    (2, 15),
    (3, 10),
    (4, 20),
    (5, 16)
) AS v (hari, kuota)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.sesi_praktik AS s
    WHERE s.tanggal = DATEADD(DAY, v.hari, @hari_ini)
      AND s.jam_mulai = CAST('08:00' AS TIME(0))
);

/* ============================================================================
   7. konten_publik - satu baris per tipe
   ============================================================================ */
INSERT INTO dbo.konten_publik (tipe, judul, isi, media_url, urutan)
SELECT v.tipe, v.judul, v.isi, v.media_url, v.urutan
FROM (VALUES
    ('PROFIL',
     N'Tentang Praktik Bidan',
     N'Praktik mandiri bidan yang melayani pemeriksaan kehamilan, persalinan, nifas, KB, imunisasi, dan pelayanan umum dengan pendampingan penuh.',
     CAST(NULL AS NVARCHAR(500)), 1),
    ('LAYANAN',
     N'Layanan Kami',
     N'ANC, persalinan normal, pemeriksaan nifas, KB, imunisasi bayi, senam hamil, pemeriksaan umum, dan konsultasi gizi.',
     CAST(NULL AS NVARCHAR(500)), 2),
    ('KONTAK',
     N'Hubungi Kami',
     N'Alamat: Jl. Kesehatan No. 10. Telepon/WhatsApp: 081234567801. Jam praktik: Senin-Sabtu 08.00-12.00 WIB.',
     CAST(NULL AS NVARCHAR(500)), 3),
    ('GALERI',
     N'Galeri Praktik',
     N'Dokumentasi ruang periksa dan area tunggu pasien.',
     N'/images/galeri/ruang-periksa.jpg', 4),
    ('TESTIMONI',
     N'Testimoni Ibu A.',
     N'Ibu A. - pelayanan ramah dan pemeriksaan kehamilan terasa nyaman.',
     CAST(NULL AS NVARCHAR(500)), 5)
) AS v (tipe, judul, isi, media_url, urutan)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.konten_publik AS k
    WHERE k.tipe = v.tipe AND k.judul = v.judul
);
GO
