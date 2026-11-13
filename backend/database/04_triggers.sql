/* ============================================================================
   Praktik Mandiri Bidan - 04_triggers.sql
   SQL Server 2025
   ----------------------------------------------------------------------------
   Isi   : 15 trigger audit AFTER INSERT, UPDATE, DELETE (satu baris audit per
           PK yang terpengaruh, set-based, tanpa cursor) + 1 trigger penjaga
           audit_logs append-only.
   Sifat : idempotent (CREATE OR ALTER TRIGGER).
   Konteks sesi: aplikasi menetapkan
       EXEC sp_set_session_context @key = N'user_id', @value = <uuid>;
       EXEC sp_set_session_context @key = N'ip',      @value = N'127.0.0.1';
   sebelum menjalankan DML; trigger membaca keduanya untuk user_id/ip_address.
   ----------------------------------------------------------------------------
   Sengaja TIDAK diaudit (lihat juga 01_schema.sql):
   - otp_reset       : hanya hash OTP; rahasia tidak boleh masuk jejak audit.
   - log_notifikasi  : payload pesan WhatsApp; sudah berupa log operasional.
   - audit_logs      : tabel audit itu sendiri; dijaga trigger immutability.
   ============================================================================ */

USE PraktikBidan;
GO

/* ============================================================================
   trg_audit_users - audit perubahan dbo.users
   Daftar kolom JSON eksplisit dan sengaja TANPA password_hash: audit_logs
   dibaca oleh BIDAN sehingga rahasia tidak boleh masuk jejak audit.
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_users
    ON dbo.users
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.user_id IS NULL THEN 'CREATE' WHEN i.user_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'users',
        CONVERT(NVARCHAR(64), COALESCE(i.user_id, d.user_id)),
        CASE WHEN d.user_id IS NULL THEN NULL ELSE
            (SELECT d2.user_id,
                       d2.username,
                       d2.nama_lengkap,
                       d2.role,
                       d2.no_telepon,
                       d2.is_active,
                       d2.last_login_at,
                       d2.created_at
             FROM deleted d2 WHERE d2.user_id = d.user_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.user_id IS NULL THEN NULL ELSE
            (SELECT i2.user_id,
                       i2.username,
                       i2.nama_lengkap,
                       i2.role,
                       i2.no_telepon,
                       i2.is_active,
                       i2.last_login_at,
                       i2.created_at
             FROM inserted i2 WHERE i2.user_id = i.user_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.user_id = i.user_id;
END;
GO

/* ============================================================================
   trg_audit_pasien - audit perubahan dbo.pasien
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_pasien
    ON dbo.pasien
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.pasien_id IS NULL THEN 'CREATE' WHEN i.pasien_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'pasien',
        CONVERT(NVARCHAR(64), COALESCE(i.pasien_id, d.pasien_id)),
        CASE WHEN d.pasien_id IS NULL THEN NULL ELSE
            (SELECT d2.pasien_id,
                       d2.nik,
                       d2.nama,
                       d2.tgl_lahir,
                       d2.alamat,
                       d2.no_telepon,
                       d2.is_active,
                       d2.created_at,
                       d2.updated_at
             FROM deleted d2 WHERE d2.pasien_id = d.pasien_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.pasien_id IS NULL THEN NULL ELSE
            (SELECT i2.pasien_id,
                       i2.nik,
                       i2.nama,
                       i2.tgl_lahir,
                       i2.alamat,
                       i2.no_telepon,
                       i2.is_active,
                       i2.created_at,
                       i2.updated_at
             FROM inserted i2 WHERE i2.pasien_id = i.pasien_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.pasien_id = i.pasien_id;
END;
GO

/* ============================================================================
   trg_audit_sesi_praktik - audit perubahan dbo.sesi_praktik
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_sesi_praktik
    ON dbo.sesi_praktik
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.sesi_id IS NULL THEN 'CREATE' WHEN i.sesi_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'sesi_praktik',
        CONVERT(NVARCHAR(64), COALESCE(i.sesi_id, d.sesi_id)),
        CASE WHEN d.sesi_id IS NULL THEN NULL ELSE
            (SELECT d2.sesi_id,
                       d2.tanggal,
                       d2.jam_mulai,
                       d2.jam_selesai,
                       d2.kuota_maks,
                       d2.durasi_per_pasien,
                       d2.is_active,
                       d2.created_at,
                       d2.updated_at
             FROM deleted d2 WHERE d2.sesi_id = d.sesi_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.sesi_id IS NULL THEN NULL ELSE
            (SELECT i2.sesi_id,
                       i2.tanggal,
                       i2.jam_mulai,
                       i2.jam_selesai,
                       i2.kuota_maks,
                       i2.durasi_per_pasien,
                       i2.is_active,
                       i2.created_at,
                       i2.updated_at
             FROM inserted i2 WHERE i2.sesi_id = i.sesi_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.sesi_id = i.sesi_id;
END;
GO

/* ============================================================================
   trg_audit_layanan - audit perubahan dbo.layanan
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_layanan
    ON dbo.layanan
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.layanan_id IS NULL THEN 'CREATE' WHEN i.layanan_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'layanan',
        CONVERT(NVARCHAR(64), COALESCE(i.layanan_id, d.layanan_id)),
        CASE WHEN d.layanan_id IS NULL THEN NULL ELSE
            (SELECT d2.layanan_id,
                       d2.nama,
                       d2.kategori,
                       d2.deskripsi,
                       d2.is_active,
                       d2.created_at,
                       d2.updated_at
             FROM deleted d2 WHERE d2.layanan_id = d.layanan_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.layanan_id IS NULL THEN NULL ELSE
            (SELECT i2.layanan_id,
                       i2.nama,
                       i2.kategori,
                       i2.deskripsi,
                       i2.is_active,
                       i2.created_at,
                       i2.updated_at
             FROM inserted i2 WHERE i2.layanan_id = i.layanan_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.layanan_id = i.layanan_id;
END;
GO

/* ============================================================================
   trg_audit_reservasi - audit perubahan dbo.reservasi
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_reservasi
    ON dbo.reservasi
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.reservasi_id IS NULL THEN 'CREATE' WHEN i.reservasi_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'reservasi',
        CONVERT(NVARCHAR(64), COALESCE(i.reservasi_id, d.reservasi_id)),
        CASE WHEN d.reservasi_id IS NULL THEN NULL ELSE
            (SELECT d2.reservasi_id,
                       d2.pasien_id,
                       d2.sesi_id,
                       d2.layanan_id,
                       d2.nomor_antrean,
                       d2.estimasi_jam,
                       d2.metode_daftar,
                       d2.status,
                       d2.alasan_batal,
                       d2.dibuat_oleh,
                       d2.created_at,
                       d2.updated_at
             FROM deleted d2 WHERE d2.reservasi_id = d.reservasi_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.reservasi_id IS NULL THEN NULL ELSE
            (SELECT i2.reservasi_id,
                       i2.pasien_id,
                       i2.sesi_id,
                       i2.layanan_id,
                       i2.nomor_antrean,
                       i2.estimasi_jam,
                       i2.metode_daftar,
                       i2.status,
                       i2.alasan_batal,
                       i2.dibuat_oleh,
                       i2.created_at,
                       i2.updated_at
             FROM inserted i2 WHERE i2.reservasi_id = i.reservasi_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.reservasi_id = i.reservasi_id;
END;
GO

/* ============================================================================
   trg_audit_kunjungan - audit perubahan dbo.kunjungan
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_kunjungan
    ON dbo.kunjungan
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.kunjungan_id IS NULL THEN 'CREATE' WHEN i.kunjungan_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'kunjungan',
        CONVERT(NVARCHAR(64), COALESCE(i.kunjungan_id, d.kunjungan_id)),
        CASE WHEN d.kunjungan_id IS NULL THEN NULL ELSE
            (SELECT d2.kunjungan_id,
                       d2.pasien_id,
                       d2.reservasi_id,
                       d2.bidan_id,
                       d2.layanan_id,
                       d2.tanggal_kunjungan,
                       d2.keluhan,
                       d2.pemeriksaan_fisik,
                       d2.diagnosis,
                       d2.tindakan,
                       d2.catatan_bebas,
                       d2.koreksi_dari_id,
                       d2.created_at
             FROM deleted d2 WHERE d2.kunjungan_id = d.kunjungan_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.kunjungan_id IS NULL THEN NULL ELSE
            (SELECT i2.kunjungan_id,
                       i2.pasien_id,
                       i2.reservasi_id,
                       i2.bidan_id,
                       i2.layanan_id,
                       i2.tanggal_kunjungan,
                       i2.keluhan,
                       i2.pemeriksaan_fisik,
                       i2.diagnosis,
                       i2.tindakan,
                       i2.catatan_bebas,
                       i2.koreksi_dari_id,
                       i2.created_at
             FROM inserted i2 WHERE i2.kunjungan_id = i.kunjungan_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.kunjungan_id = i.kunjungan_id;
END;
GO

/* ============================================================================
   trg_audit_resep_item - audit perubahan dbo.resep_item
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_resep_item
    ON dbo.resep_item
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.resep_id IS NULL THEN 'CREATE' WHEN i.resep_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'resep_item',
        CONVERT(NVARCHAR(64), COALESCE(i.resep_id, d.resep_id)),
        CASE WHEN d.resep_id IS NULL THEN NULL ELSE
            (SELECT d2.resep_id,
                       d2.kunjungan_id,
                       d2.item_id,
                       d2.jumlah,
                       d2.aturan_pakai,
                       d2.created_at
             FROM deleted d2 WHERE d2.resep_id = d.resep_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.resep_id IS NULL THEN NULL ELSE
            (SELECT i2.resep_id,
                       i2.kunjungan_id,
                       i2.item_id,
                       i2.jumlah,
                       i2.aturan_pakai,
                       i2.created_at
             FROM inserted i2 WHERE i2.resep_id = i.resep_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.resep_id = i.resep_id;
END;
GO

/* ============================================================================
   trg_audit_alergi_kondisi - audit perubahan dbo.alergi_kondisi
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_alergi_kondisi
    ON dbo.alergi_kondisi
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.alergi_id IS NULL THEN 'CREATE' WHEN i.alergi_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'alergi_kondisi',
        CONVERT(NVARCHAR(64), COALESCE(i.alergi_id, d.alergi_id)),
        CASE WHEN d.alergi_id IS NULL THEN NULL ELSE
            (SELECT d2.alergi_id,
                       d2.pasien_id,
                       d2.item_id,
                       d2.kategori,
                       d2.nama,
                       d2.keterangan,
                       d2.is_active,
                       d2.dicatat_oleh,
                       d2.created_at,
                       d2.updated_at
             FROM deleted d2 WHERE d2.alergi_id = d.alergi_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.alergi_id IS NULL THEN NULL ELSE
            (SELECT i2.alergi_id,
                       i2.pasien_id,
                       i2.item_id,
                       i2.kategori,
                       i2.nama,
                       i2.keterangan,
                       i2.is_active,
                       i2.dicatat_oleh,
                       i2.created_at,
                       i2.updated_at
             FROM inserted i2 WHERE i2.alergi_id = i.alergi_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.alergi_id = i.alergi_id;
END;
GO

/* ============================================================================
   trg_audit_item_inventaris - audit perubahan dbo.item_inventaris
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_item_inventaris
    ON dbo.item_inventaris
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.item_id IS NULL THEN 'CREATE' WHEN i.item_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'item_inventaris',
        CONVERT(NVARCHAR(64), COALESCE(i.item_id, d.item_id)),
        CASE WHEN d.item_id IS NULL THEN NULL ELSE
            (SELECT d2.item_id,
                       d2.nama,
                       d2.kategori,
                       d2.satuan,
                       d2.stok,
                       d2.stok_minimum,
                       d2.tgl_kedaluwarsa,
                       d2.is_active,
                       d2.created_at,
                       d2.updated_at
             FROM deleted d2 WHERE d2.item_id = d.item_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.item_id IS NULL THEN NULL ELSE
            (SELECT i2.item_id,
                       i2.nama,
                       i2.kategori,
                       i2.satuan,
                       i2.stok,
                       i2.stok_minimum,
                       i2.tgl_kedaluwarsa,
                       i2.is_active,
                       i2.created_at,
                       i2.updated_at
             FROM inserted i2 WHERE i2.item_id = i.item_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.item_id = i.item_id;
END;
GO

/* ============================================================================
   trg_audit_riwayat_stok - audit perubahan dbo.riwayat_stok
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_riwayat_stok
    ON dbo.riwayat_stok
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.riwayat_id IS NULL THEN 'CREATE' WHEN i.riwayat_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'riwayat_stok',
        CONVERT(NVARCHAR(64), COALESCE(i.riwayat_id, d.riwayat_id)),
        CASE WHEN d.riwayat_id IS NULL THEN NULL ELSE
            (SELECT d2.riwayat_id,
                       d2.item_id,
                       d2.kunjungan_id,
                       d2.user_id,
                       d2.jenis,
                       d2.jumlah,
                       d2.keterangan,
                       d2.tanggal
             FROM deleted d2 WHERE d2.riwayat_id = d.riwayat_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.riwayat_id IS NULL THEN NULL ELSE
            (SELECT i2.riwayat_id,
                       i2.item_id,
                       i2.kunjungan_id,
                       i2.user_id,
                       i2.jenis,
                       i2.jumlah,
                       i2.keterangan,
                       i2.tanggal
             FROM inserted i2 WHERE i2.riwayat_id = i.riwayat_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.riwayat_id = i.riwayat_id;
END;
GO

/* ============================================================================
   trg_audit_riwayat_harga - audit perubahan dbo.riwayat_harga
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_riwayat_harga
    ON dbo.riwayat_harga
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.harga_id IS NULL THEN 'CREATE' WHEN i.harga_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'riwayat_harga',
        CONVERT(NVARCHAR(64), COALESCE(i.harga_id, d.harga_id)),
        CASE WHEN d.harga_id IS NULL THEN NULL ELSE
            (SELECT d2.harga_id,
                       d2.ref_tipe,
                       d2.item_id,
                       d2.layanan_id,
                       d2.harga,
                       d2.berlaku_dari,
                       d2.berlaku_sampai,
                       d2.alasan,
                       d2.diubah_oleh,
                       d2.created_at
             FROM deleted d2 WHERE d2.harga_id = d.harga_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.harga_id IS NULL THEN NULL ELSE
            (SELECT i2.harga_id,
                       i2.ref_tipe,
                       i2.item_id,
                       i2.layanan_id,
                       i2.harga,
                       i2.berlaku_dari,
                       i2.berlaku_sampai,
                       i2.alasan,
                       i2.diubah_oleh,
                       i2.created_at
             FROM inserted i2 WHERE i2.harga_id = i.harga_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.harga_id = i.harga_id;
END;
GO

/* ============================================================================
   trg_audit_tagihan - audit perubahan dbo.tagihan
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_tagihan
    ON dbo.tagihan
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.tagihan_id IS NULL THEN 'CREATE' WHEN i.tagihan_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'tagihan',
        CONVERT(NVARCHAR(64), COALESCE(i.tagihan_id, d.tagihan_id)),
        CASE WHEN d.tagihan_id IS NULL THEN NULL ELSE
            (SELECT d2.tagihan_id,
                       d2.kunjungan_id,
                       d2.total_tagihan,
                       d2.total_dibayar,
                       d2.status,
                       d2.created_at,
                       d2.updated_at
             FROM deleted d2 WHERE d2.tagihan_id = d.tagihan_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.tagihan_id IS NULL THEN NULL ELSE
            (SELECT i2.tagihan_id,
                       i2.kunjungan_id,
                       i2.total_tagihan,
                       i2.total_dibayar,
                       i2.status,
                       i2.created_at,
                       i2.updated_at
             FROM inserted i2 WHERE i2.tagihan_id = i.tagihan_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.tagihan_id = i.tagihan_id;
END;
GO

/* ============================================================================
   trg_audit_tagihan_rincian - audit perubahan dbo.tagihan_rincian
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_tagihan_rincian
    ON dbo.tagihan_rincian
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.rincian_id IS NULL THEN 'CREATE' WHEN i.rincian_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'tagihan_rincian',
        CONVERT(NVARCHAR(64), COALESCE(i.rincian_id, d.rincian_id)),
        CASE WHEN d.rincian_id IS NULL THEN NULL ELSE
            (SELECT d2.rincian_id,
                       d2.tagihan_id,
                       d2.item_id,
                       d2.layanan_id,
                       d2.qty,
                       d2.harga_satuan,
                       d2.created_at
             FROM deleted d2 WHERE d2.rincian_id = d.rincian_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.rincian_id IS NULL THEN NULL ELSE
            (SELECT i2.rincian_id,
                       i2.tagihan_id,
                       i2.item_id,
                       i2.layanan_id,
                       i2.qty,
                       i2.harga_satuan,
                       i2.created_at
             FROM inserted i2 WHERE i2.rincian_id = i.rincian_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.rincian_id = i.rincian_id;
END;
GO

/* ============================================================================
   trg_audit_pembayaran - audit perubahan dbo.pembayaran
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_pembayaran
    ON dbo.pembayaran
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.pembayaran_id IS NULL THEN 'CREATE' WHEN i.pembayaran_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'pembayaran',
        CONVERT(NVARCHAR(64), COALESCE(i.pembayaran_id, d.pembayaran_id)),
        CASE WHEN d.pembayaran_id IS NULL THEN NULL ELSE
            (SELECT d2.pembayaran_id,
                       d2.tagihan_id,
                       d2.jumlah,
                       d2.jalur,
                       d2.dicatat_oleh,
                       d2.tanggal_bayar
             FROM deleted d2 WHERE d2.pembayaran_id = d.pembayaran_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.pembayaran_id IS NULL THEN NULL ELSE
            (SELECT i2.pembayaran_id,
                       i2.tagihan_id,
                       i2.jumlah,
                       i2.jalur,
                       i2.dicatat_oleh,
                       i2.tanggal_bayar
             FROM inserted i2 WHERE i2.pembayaran_id = i.pembayaran_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.pembayaran_id = i.pembayaran_id;
END;
GO

/* ============================================================================
   trg_audit_konten_publik - audit perubahan dbo.konten_publik
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_konten_publik
    ON dbo.konten_publik
    AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor    UNIQUEIDENTIFIER = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER);
    DECLARE @ip       VARCHAR(45)      = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
    DECLARE @user_ref NVARCHAR(50)     = (SELECT u.username FROM dbo.users u WHERE u.user_id = @actor);

    INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address, created_at)
    SELECT
        @actor,
        @user_ref,
        CASE WHEN d.konten_id IS NULL THEN 'CREATE' WHEN i.konten_id IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
        'konten_publik',
        CONVERT(NVARCHAR(64), COALESCE(i.konten_id, d.konten_id)),
        CASE WHEN d.konten_id IS NULL THEN NULL ELSE
            (SELECT d2.konten_id,
                       d2.tipe,
                       d2.judul,
                       d2.isi,
                       d2.media_url,
                       d2.urutan,
                       d2.is_published,
                       d2.created_at,
                       d2.updated_at
             FROM deleted d2 WHERE d2.konten_id = d.konten_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        CASE WHEN i.konten_id IS NULL THEN NULL ELSE
            (SELECT i2.konten_id,
                       i2.tipe,
                       i2.judul,
                       i2.isi,
                       i2.media_url,
                       i2.urutan,
                       i2.is_published,
                       i2.created_at,
                       i2.updated_at
             FROM inserted i2 WHERE i2.konten_id = i.konten_id
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        END,
        @ip,
        SYSDATETIME()
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.konten_id = i.konten_id;
END;
GO

/* ============================================================================
   trg_audit_logs_immutable - audit_logs bersifat append-only
   CATATAN: INSTEAD OF UPDATE/DELETE tidak bisa dipasang di tabel ini karena
   audit_logs punya FK cascading (users FK ON DELETE SET NULL); SQL Server
   menolaknya (Msg 2113). Trigger AFTER yang selalu ROLLBACK memberi efek yang
   sama: tidak ada baris yang berubah atau terhapus. Jangan ganti FK itu
   hanya demi sintaks INSTEAD OF.
   ============================================================================ */
CREATE OR ALTER TRIGGER trg_audit_logs_immutable
    ON dbo.audit_logs
    AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM inserted) OR EXISTS (SELECT 1 FROM deleted)
    BEGIN
        RAISERROR('audit_logs bersifat append-only', 16, 1);
        ROLLBACK TRANSACTION;
    END;
END;
GO
