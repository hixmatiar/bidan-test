/* ============================================================================
   Praktik Mandiri Bidan - 01_schema.sql
   SQL Server 2025
   ----------------------------------------------------------------------------
   Isi   : database + 18 tabel (urutan FK) + constraint + index.
   Sifat : idempotent (aman dijalankan berulang). Semua objek dijaga
           IF OBJECT_ID(...) IS NULL, tanpa CREATE OR ALTER.
   Catatan:
   - Soft delete: users/pasien/sesi_praktik/layanan/item_inventaris memakai
     is_active = 0, konten_publik memakai is_published = 0. Tidak ada DELETE
     fisik untuk data pasien/klinis.
   - audit_logs append-only (dijaga trigger INSTEAD OF pada 04_triggers.sql).
     users memakai soft delete sehingga FK audit_logs.user_id ON DELETE SET NULL
     tidak pernah bertabrakan dengan trigger immutability tersebut.
   ============================================================================ */

IF DB_ID(N'PraktikBidan') IS NULL
    CREATE DATABASE PraktikBidan;
GO

USE PraktikBidan;
GO

/* Opsi SET yang dibutuhkan index terfilter (dan view terindeks kelak). */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* ============================================================================
   1. users - akun internal (BIDAN, ADMIN)
   ============================================================================ */
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        user_id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_users PRIMARY KEY,
        username        NVARCHAR(50)     NOT NULL CONSTRAINT UQ_users_username UNIQUE,
        password_hash   NVARCHAR(255)    NOT NULL,
        nama_lengkap    NVARCHAR(100)    NOT NULL,
        role            VARCHAR(10)      NOT NULL CONSTRAINT CK_users_role CHECK (role IN ('BIDAN', 'ADMIN')),
        no_telepon      NVARCHAR(20)     NULL,
        is_active       BIT              NOT NULL DEFAULT 1,
        failed_attempts TINYINT          NOT NULL DEFAULT 0 CONSTRAINT CK_users_failed_attempts CHECK (failed_attempts BETWEEN 0 AND 5),
        locked_until    DATETIME2(0)     NULL,
        last_login_at   DATETIME2(0)     NULL,
        created_at      DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        updated_at      DATETIME2(0)     NULL
    );
END;
GO

/* ============================================================================
   2. otp_reset - hash OTP 6 digit untuk reset kata sandi
   ============================================================================ */
IF OBJECT_ID(N'dbo.otp_reset', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.otp_reset (
        otp_id      UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_otp_reset PRIMARY KEY,
        user_id     UNIQUEIDENTIFIER NOT NULL,
        otp_hash    NVARCHAR(255)    NOT NULL,
        expired_at  DATETIME2(0)     NOT NULL,
        is_used     BIT              NOT NULL DEFAULT 0,
        created_at  DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_otp_reset_users FOREIGN KEY (user_id)
            REFERENCES dbo.users (user_id) ON DELETE CASCADE
    );
END;
GO

/* ============================================================================
   3. pasien - identitas pasien (NIK 16 digit, unik)
   ============================================================================ */
IF OBJECT_ID(N'dbo.pasien', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.pasien (
        pasien_id   UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_pasien PRIMARY KEY,
        nik         CHAR(16)         NOT NULL CONSTRAINT UQ_pasien_nik UNIQUE,
        nama        NVARCHAR(100)    NOT NULL,
        tgl_lahir   DATE             NOT NULL,
        alamat      NVARCHAR(255)    NULL,
        no_telepon  NVARCHAR(20)     NOT NULL,
        is_active   BIT              NOT NULL DEFAULT 1,
        created_at  DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        updated_at  DATETIME2(0)     NULL,
        CONSTRAINT CK_pasien_nik_digit CHECK (nik NOT LIKE '%[^0-9]%')
    );
END;
GO

/* ============================================================================
   4. sesi_praktik - jadwal buka praktik per tanggal
   ============================================================================ */
IF OBJECT_ID(N'dbo.sesi_praktik', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sesi_praktik (
        sesi_id           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_sesi_praktik PRIMARY KEY,
        tanggal           DATE             NOT NULL,
        jam_mulai         TIME(0)          NOT NULL,
        jam_selesai       TIME(0)          NOT NULL,
        kuota_maks        INT              NOT NULL CONSTRAINT CK_sesi_kuota CHECK (kuota_maks BETWEEN 1 AND 200),
        durasi_per_pasien INT              NOT NULL DEFAULT 15 CONSTRAINT CK_sesi_durasi CHECK (durasi_per_pasien BETWEEN 5 AND 60),
        is_active         BIT              NOT NULL DEFAULT 1,
        created_at        DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        updated_at        DATETIME2(0)     NULL,
        CONSTRAINT CK_sesi_jam CHECK (jam_selesai > jam_mulai)
    );
END;
GO

/* ============================================================================
   5. layanan - master layanan (KEBIDANAN, UMUM)
   ============================================================================ */
IF OBJECT_ID(N'dbo.layanan', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.layanan (
        layanan_id  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_layanan PRIMARY KEY,
        nama        NVARCHAR(100)    NOT NULL CONSTRAINT UQ_layanan_nama UNIQUE,
        kategori    VARCHAR(20)      NOT NULL CONSTRAINT CK_layanan_kategori CHECK (kategori IN ('KEBIDANAN', 'UMUM')),
        deskripsi   NVARCHAR(500)    NULL,
        is_active   BIT              NOT NULL DEFAULT 1,
        created_at  DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        updated_at  DATETIME2(0)     NULL
    );
END;
GO

/* ============================================================================
   6. item_inventaris - master obat & produk kesehatan
   ============================================================================ */
IF OBJECT_ID(N'dbo.item_inventaris', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.item_inventaris (
        item_id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_item_inventaris PRIMARY KEY,
        nama             NVARCHAR(100)    NOT NULL,
        kategori         VARCHAR(30)      NOT NULL CONSTRAINT CK_item_kategori CHECK (kategori IN ('OBAT', 'PRODUK_KESEHATAN')),
        satuan           NVARCHAR(20)     NOT NULL,
        stok             DECIMAL(10, 2)   NOT NULL DEFAULT 0 CONSTRAINT CK_item_stok CHECK (stok >= 0),
        stok_minimum     DECIMAL(10, 2)   NOT NULL DEFAULT 0 CONSTRAINT CK_item_stok_minimum CHECK (stok_minimum >= 0),
        tgl_kedaluwarsa  DATE             NULL,
        is_active        BIT              NOT NULL DEFAULT 1,
        created_at       DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        updated_at       DATETIME2(0)     NULL
    );
END;
GO

/* ============================================================================
   7. konten_publik - konten beranda (soft delete via is_published = 0)
   ============================================================================ */
IF OBJECT_ID(N'dbo.konten_publik', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.konten_publik (
        konten_id    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_konten_publik PRIMARY KEY,
        tipe         VARCHAR(20)      NOT NULL CONSTRAINT CK_konten_tipe CHECK (tipe IN ('PROFIL', 'LAYANAN', 'KONTAK', 'GALERI', 'TESTIMONI')),
        judul        NVARCHAR(150)    NOT NULL,
        isi          NVARCHAR(MAX)    NULL,
        media_url    NVARCHAR(500)    NULL,
        urutan       INT              NOT NULL DEFAULT 0,
        is_published BIT              NOT NULL DEFAULT 1,
        created_at   DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        updated_at   DATETIME2(0)     NULL
    );
END;
GO

/* ============================================================================
   8. reservasi - pendaftaran online / walk-in, antrean per sesi
   ============================================================================ */
IF OBJECT_ID(N'dbo.reservasi', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.reservasi (
        reservasi_id  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_reservasi PRIMARY KEY,
        pasien_id     UNIQUEIDENTIFIER NOT NULL,
        sesi_id       UNIQUEIDENTIFIER NOT NULL,
        layanan_id    UNIQUEIDENTIFIER NOT NULL,
        nomor_antrean INT              NOT NULL CONSTRAINT CK_reservasi_nomor CHECK (nomor_antrean > 0),
        estimasi_jam  TIME(0)          NOT NULL,
        metode_daftar VARCHAR(20)      NOT NULL DEFAULT 'ONLINE' CONSTRAINT CK_reservasi_metode CHECK (metode_daftar IN ('ONLINE', 'MANUAL_ADMIN')),
        status        VARCHAR(20)      NOT NULL DEFAULT 'MENUNGGU' CONSTRAINT CK_reservasi_status CHECK (status IN ('MENUNGGU', 'DIPANGGIL', 'SELESAI', 'DIBATALKAN')),
        alasan_batal  NVARCHAR(255)    NULL,
        dibuat_oleh   UNIQUEIDENTIFIER NULL,
        created_at    DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        updated_at    DATETIME2(0)     NULL,
        CONSTRAINT FK_reservasi_pasien FOREIGN KEY (pasien_id) REFERENCES dbo.pasien (pasien_id),
        CONSTRAINT FK_reservasi_sesi   FOREIGN KEY (sesi_id)   REFERENCES dbo.sesi_praktik (sesi_id),
        CONSTRAINT FK_reservasi_layanan FOREIGN KEY (layanan_id) REFERENCES dbo.layanan (layanan_id),
        CONSTRAINT FK_reservasi_users  FOREIGN KEY (dibuat_oleh) REFERENCES dbo.users (user_id)
    );
END;
GO

/* ============================================================================
   9. kunjungan - RME per kunjungan (append-only, koreksi via self-FK)
   ============================================================================ */
IF OBJECT_ID(N'dbo.kunjungan', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.kunjungan (
        kunjungan_id        UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_kunjungan PRIMARY KEY,
        pasien_id           UNIQUEIDENTIFIER NOT NULL,
        reservasi_id        UNIQUEIDENTIFIER NULL,
        bidan_id            UNIQUEIDENTIFIER NOT NULL,
        layanan_id          UNIQUEIDENTIFIER NOT NULL,
        tanggal_kunjungan   DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        keluhan             NVARCHAR(MAX)    NULL,
        pemeriksaan_fisik   NVARCHAR(MAX)    NULL,
        diagnosis           NVARCHAR(MAX)    NULL,
        tindakan            NVARCHAR(MAX)    NULL,
        catatan_bebas       NVARCHAR(MAX)    NULL,
        koreksi_dari_id     UNIQUEIDENTIFIER NULL,
        created_at          DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_kunjungan_pasien   FOREIGN KEY (pasien_id) REFERENCES dbo.pasien (pasien_id),
        CONSTRAINT FK_kunjungan_reservasi FOREIGN KEY (reservasi_id) REFERENCES dbo.reservasi (reservasi_id),
        CONSTRAINT FK_kunjungan_bidan    FOREIGN KEY (bidan_id) REFERENCES dbo.users (user_id),
        CONSTRAINT FK_kunjungan_layanan  FOREIGN KEY (layanan_id) REFERENCES dbo.layanan (layanan_id),
        CONSTRAINT FK_kunjungan_koreksi  FOREIGN KEY (koreksi_dari_id) REFERENCES dbo.kunjungan (kunjungan_id)
    );
END;
GO

/* ============================================================================
   10. resep_item - obat yang diresepkan per kunjungan
   Sengaja TANPA unique (kunjungan_id, item_id): baris duplikat diizinkan dan
   diagregasi oleh sp_simpan_kunjungan dari TVP.
   ============================================================================ */
IF OBJECT_ID(N'dbo.resep_item', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.resep_item (
        resep_id     UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_resep_item PRIMARY KEY,
        kunjungan_id UNIQUEIDENTIFIER NOT NULL,
        item_id      UNIQUEIDENTIFIER NOT NULL,
        jumlah       DECIMAL(10, 2)   NOT NULL CONSTRAINT CK_resep_jumlah CHECK (jumlah > 0),
        aturan_pakai NVARCHAR(100)    NULL,
        created_at   DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_resep_kunjungan FOREIGN KEY (kunjungan_id) REFERENCES dbo.kunjungan (kunjungan_id),
        CONSTRAINT FK_resep_item      FOREIGN KEY (item_id) REFERENCES dbo.item_inventaris (item_id)
    );
END;
GO

/* ============================================================================
   11. alergi_kondisi - red-flag pasien (alergi obat, kehamilan risti, dll.)
   item_id nullable; wajib hanya untuk ALERGI_OBAT (divalidasi aplikasi & CHECK).
   ============================================================================ */
IF OBJECT_ID(N'dbo.alergi_kondisi', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.alergi_kondisi (
        alergi_id   UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_alergi_kondisi PRIMARY KEY,
        pasien_id   UNIQUEIDENTIFIER NOT NULL,
        item_id     UNIQUEIDENTIFIER NULL,
        kategori    VARCHAR(20)      NOT NULL CONSTRAINT CK_alergi_kategori CHECK (kategori IN ('ALERGI_OBAT', 'KEHAMILAN_RISTI', 'PENYAKIT_BAWAAN')),
        nama        NVARCHAR(150)    NULL,
        keterangan  NVARCHAR(500)    NULL,
        is_active   BIT              NOT NULL DEFAULT 1,
        dicatat_oleh UNIQUEIDENTIFIER NULL,
        created_at  DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        updated_at  DATETIME2(0)     NULL,
        CONSTRAINT FK_alergi_pasien FOREIGN KEY (pasien_id) REFERENCES dbo.pasien (pasien_id),
        CONSTRAINT FK_alergi_item   FOREIGN KEY (item_id) REFERENCES dbo.item_inventaris (item_id),
        CONSTRAINT FK_alergi_users  FOREIGN KEY (dicatat_oleh) REFERENCES dbo.users (user_id),
        CONSTRAINT CK_alergi_obat_item CHECK (kategori <> 'ALERGI_OBAT' OR item_id IS NOT NULL)
    );
END;
GO

/* ============================================================================
   12. riwayat_stok - mutasi stok (RESTOCK, PAKAI, KOREKSI)
   ============================================================================ */
IF OBJECT_ID(N'dbo.riwayat_stok', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.riwayat_stok (
        riwayat_id   UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_riwayat_stok PRIMARY KEY,
        item_id      UNIQUEIDENTIFIER NOT NULL,
        kunjungan_id UNIQUEIDENTIFIER NULL,
        user_id      UNIQUEIDENTIFIER NULL,
        jenis        VARCHAR(20)      NOT NULL CONSTRAINT CK_riwayat_stok_jenis CHECK (jenis IN ('RESTOCK', 'PAKAI', 'KOREKSI')),
        jumlah       DECIMAL(10, 2)   NOT NULL CONSTRAINT CK_riwayat_stok_jumlah CHECK (jumlah > 0),
        keterangan   NVARCHAR(255)    NULL,
        tanggal      DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_riwayat_stok_item      FOREIGN KEY (item_id) REFERENCES dbo.item_inventaris (item_id),
        CONSTRAINT FK_riwayat_stok_kunjungan FOREIGN KEY (kunjungan_id) REFERENCES dbo.kunjungan (kunjungan_id),
        CONSTRAINT FK_riwayat_stok_users     FOREIGN KEY (user_id) REFERENCES dbo.users (user_id)
    );
END;
GO

/* ============================================================================
   13. riwayat_harga - harga append-only untuk ITEM atau LAYANAN
   Tepat satu dari item_id/layanan_id wajib terisi dan harus cocok ref_tipe.
   ============================================================================ */
IF OBJECT_ID(N'dbo.riwayat_harga', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.riwayat_harga (
        harga_id       UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_riwayat_harga PRIMARY KEY,
        ref_tipe       VARCHAR(10)      NOT NULL CONSTRAINT CK_riwayat_harga_tipe CHECK (ref_tipe IN ('ITEM', 'LAYANAN')),
        item_id        UNIQUEIDENTIFIER NULL,
        layanan_id     UNIQUEIDENTIFIER NULL,
        harga          DECIMAL(18, 2)   NOT NULL CONSTRAINT CK_riwayat_harga_nilai CHECK (harga >= 0),
        berlaku_dari   DATE             NOT NULL,
        berlaku_sampai DATE             NULL,
        alasan         NVARCHAR(255)    NULL,
        diubah_oleh    UNIQUEIDENTIFIER NULL,
        created_at     DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_riwayat_harga_item    FOREIGN KEY (item_id) REFERENCES dbo.item_inventaris (item_id),
        CONSTRAINT FK_riwayat_harga_layanan FOREIGN KEY (layanan_id) REFERENCES dbo.layanan (layanan_id),
        CONSTRAINT FK_riwayat_harga_users   FOREIGN KEY (diubah_oleh) REFERENCES dbo.users (user_id),
        CONSTRAINT CK_riwayat_harga_ref CHECK (
            (ref_tipe = 'ITEM'    AND item_id IS NOT NULL AND layanan_id IS NULL)
            OR
            (ref_tipe = 'LAYANAN' AND item_id IS NULL AND layanan_id IS NOT NULL)
        ),
        CONSTRAINT CK_riwayat_harga_periode CHECK (berlaku_sampai IS NULL OR berlaku_sampai >= berlaku_dari)
    );
END;
GO

/* ============================================================================
   14. tagihan - 1:1 dengan kunjungan
   ============================================================================ */
IF OBJECT_ID(N'dbo.tagihan', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tagihan (
        tagihan_id     UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_tagihan PRIMARY KEY,
        kunjungan_id   UNIQUEIDENTIFIER NOT NULL CONSTRAINT UQ_tagihan_kunjungan UNIQUE,
        total_tagihan  DECIMAL(18, 2)   NOT NULL DEFAULT 0 CONSTRAINT CK_tagihan_total CHECK (total_tagihan >= 0),
        total_dibayar  DECIMAL(18, 2)   NOT NULL DEFAULT 0 CONSTRAINT CK_tagihan_dibayar CHECK (total_dibayar >= 0),
        status         VARCHAR(20)      NOT NULL DEFAULT 'BELUM_LUNAS' CONSTRAINT CK_tagihan_status CHECK (status IN ('BELUM_LUNAS', 'LUNAS')),
        created_at     DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        updated_at     DATETIME2(0)     NULL,
        CONSTRAINT FK_tagihan_kunjungan FOREIGN KEY (kunjungan_id) REFERENCES dbo.kunjungan (kunjungan_id)
    );
END;
GO

/* ============================================================================
   15. tagihan_rincian - snapshot harga per baris tagihan
   subtotal adalah computed column PERSISTED (qty * harga_satuan).
   ============================================================================ */
IF OBJECT_ID(N'dbo.tagihan_rincian', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tagihan_rincian (
        rincian_id   UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_tagihan_rincian PRIMARY KEY,
        tagihan_id   UNIQUEIDENTIFIER NOT NULL,
        item_id      UNIQUEIDENTIFIER NULL,
        layanan_id   UNIQUEIDENTIFIER NULL,
        qty          DECIMAL(10, 2)   NOT NULL CONSTRAINT CK_rincian_qty CHECK (qty > 0),
        harga_satuan DECIMAL(18, 2)   NOT NULL CONSTRAINT CK_rincian_harga CHECK (harga_satuan >= 0),
        subtotal     AS (qty * harga_satuan) PERSISTED,
        created_at   DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_rincian_tagihan FOREIGN KEY (tagihan_id) REFERENCES dbo.tagihan (tagihan_id) ON DELETE CASCADE,
        CONSTRAINT FK_rincian_item    FOREIGN KEY (item_id) REFERENCES dbo.item_inventaris (item_id),
        CONSTRAINT FK_rincian_layanan FOREIGN KEY (layanan_id) REFERENCES dbo.layanan (layanan_id),
        CONSTRAINT CK_rincian_ref CHECK (
            (item_id IS NOT NULL AND layanan_id IS NULL)
            OR
            (item_id IS NULL AND layanan_id IS NOT NULL)
        )
    );
END;
GO

/* ============================================================================
   16. pembayaran - pembayaran penuh / cicilan per tagihan
   ============================================================================ */
IF OBJECT_ID(N'dbo.pembayaran', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.pembayaran (
        pembayaran_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_pembayaran PRIMARY KEY,
        tagihan_id    UNIQUEIDENTIFIER NOT NULL,
        jumlah        DECIMAL(18, 2)   NOT NULL CONSTRAINT CK_pembayaran_jumlah CHECK (jumlah > 0),
        jalur         VARCHAR(20)      NOT NULL CONSTRAINT CK_pembayaran_jalur CHECK (jalur IN ('MANDIRI', 'BPJS', 'ASURANSI')),
        dicatat_oleh  UNIQUEIDENTIFIER NULL,
        tanggal_bayar DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_pembayaran_tagihan FOREIGN KEY (tagihan_id) REFERENCES dbo.tagihan (tagihan_id),
        CONSTRAINT FK_pembayaran_users   FOREIGN KEY (dicatat_oleh) REFERENCES dbo.users (user_id)
    );
END;
GO

/* ============================================================================
   17. log_notifikasi - log pengiriman WhatsApp
   reservasi_id nullable: INVENTARIS dan OTP tidak terkait reservasi.
   ============================================================================ */
IF OBJECT_ID(N'dbo.log_notifikasi', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.log_notifikasi (
        notif_id     UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() CONSTRAINT PK_log_notifikasi PRIMARY KEY,
        reservasi_id UNIQUEIDENTIFIER NULL,
        jenis        VARCHAR(20)      NOT NULL CONSTRAINT CK_notif_jenis CHECK (jenis IN ('KONFIRMASI', 'PENGINGAT_H1', 'PERUBAHAN', 'INVENTARIS', 'OTP')),
        no_telepon   NVARCHAR(20)     NULL,
        pesan        NVARCHAR(MAX)    NULL,
        status       VARCHAR(20)      NOT NULL DEFAULT 'GAGAL' CONSTRAINT CK_notif_status CHECK (status IN ('TERKIRIM', 'GAGAL')),
        retry_count  TINYINT          NOT NULL DEFAULT 0 CONSTRAINT CK_notif_retry CHECK (retry_count BETWEEN 0 AND 3),
        waktu_kirim  DATETIME2(0)     NULL,
        created_at   DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_notif_reservasi FOREIGN KEY (reservasi_id) REFERENCES dbo.reservasi (reservasi_id)
    );
END;
GO

/* ============================================================================
   18. audit_logs - jejak audit append-only (BIGINT IDENTITY agar kronologis)
   FK user_id ON DELETE SET NULL aman karena users hanya di-soft-delete.
   ============================================================================ */
IF OBJECT_ID(N'dbo.audit_logs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.audit_logs (
        log_id      BIGINT           IDENTITY(1, 1) NOT NULL CONSTRAINT PK_audit_logs PRIMARY KEY,
        user_id     UNIQUEIDENTIFIER NULL,
        user_ref    NVARCHAR(50)     NULL,
        aksi        VARCHAR(30)      NOT NULL,
        entitas     VARCHAR(50)      NOT NULL,
        entitas_id  NVARCHAR(64)     NULL,
        nilai_lama  NVARCHAR(MAX)    NULL CONSTRAINT CK_audit_logs_lama CHECK (nilai_lama IS NULL OR ISJSON(nilai_lama) = 1),
        nilai_baru  NVARCHAR(MAX)    NULL CONSTRAINT CK_audit_logs_baru CHECK (nilai_baru IS NULL OR ISJSON(nilai_baru) = 1),
        ip_address  VARCHAR(45)      NULL,
        created_at  DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_audit_logs_users FOREIGN KEY (user_id) REFERENCES dbo.users (user_id) ON DELETE SET NULL
    );
END;
GO

/* ============================================================================
   INDEX
   ============================================================================ */

/* Antrean aktif unik per sesi; baris DIBATALKAN tidak ikut index. */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_reservasi_sesi_antrean' AND object_id = OBJECT_ID(N'dbo.reservasi')
)
    CREATE UNIQUE INDEX UX_reservasi_sesi_antrean
        ON dbo.reservasi (sesi_id, nomor_antrean)
        WHERE status <> 'DIBATALKAN';
GO

/* Supporting indexes sesuai spesifikasi. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pasien_nik' AND object_id = OBJECT_ID(N'dbo.pasien'))
    CREATE INDEX IX_pasien_nik ON dbo.pasien (nik);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pasien_no_telepon' AND object_id = OBJECT_ID(N'dbo.pasien'))
    CREATE INDEX IX_pasien_no_telepon ON dbo.pasien (no_telepon);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_reservasi_sesi_status' AND object_id = OBJECT_ID(N'dbo.reservasi'))
    CREATE INDEX IX_reservasi_sesi_status ON dbo.reservasi (sesi_id, status);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_kunjungan_pasien_tanggal' AND object_id = OBJECT_ID(N'dbo.kunjungan'))
    CREATE INDEX IX_kunjungan_pasien_tanggal ON dbo.kunjungan (pasien_id, tanggal_kunjungan);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_kunjungan_bidan' AND object_id = OBJECT_ID(N'dbo.kunjungan'))
    CREATE INDEX IX_kunjungan_bidan ON dbo.kunjungan (bidan_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_riwayat_stok_item_tanggal' AND object_id = OBJECT_ID(N'dbo.riwayat_stok'))
    CREATE INDEX IX_riwayat_stok_item_tanggal ON dbo.riwayat_stok (item_id, tanggal);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_riwayat_harga_ref' AND object_id = OBJECT_ID(N'dbo.riwayat_harga'))
    CREATE INDEX IX_riwayat_harga_ref ON dbo.riwayat_harga (ref_tipe, item_id, layanan_id, berlaku_dari);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pembayaran_tagihan' AND object_id = OBJECT_ID(N'dbo.pembayaran'))
    CREATE INDEX IX_pembayaran_tagihan ON dbo.pembayaran (tagihan_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_audit_logs_created_at' AND object_id = OBJECT_ID(N'dbo.audit_logs'))
    CREATE INDEX IX_audit_logs_created_at ON dbo.audit_logs (created_at);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_log_notifikasi_status_jenis' AND object_id = OBJECT_ID(N'dbo.log_notifikasi'))
    CREATE INDEX IX_log_notifikasi_status_jenis ON dbo.log_notifikasi (status, jenis);
GO

/* ============================================================================
   DB_APP_USER (opsional, jalankan manual sebagai sysadmin/DBA)
   ----------------------------------------------------------------------------
   Blok ini sengaja dikomentari agar skrip tetap bisa dijalankan oleh akun
   non-sysadmin. Aplikasi terhubung memakai user database ini (tanpa DDL).
   DBA harus MEMETAKAN login (Windows/SQL) ke user DB_APP_USER, contoh:
       CREATE LOGIN bidan_app WITH PASSWORD = N'<rahasia-kuat>';
       ALTER USER DB_APP_USER WITH LOGIN = bidan_app;
   ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'DB_APP_USER')
    CREATE USER DB_APP_USER WITHOUT LOGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO DB_APP_USER;
GRANT EXECUTE ON SCHEMA::dbo TO DB_APP_USER;

-- audit_logs append-only: cabut UPDATE/DELETE untuk akun aplikasi.
DENY UPDATE, DELETE ON dbo.audit_logs TO DB_APP_USER;
   ============================================================================ */
