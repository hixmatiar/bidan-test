/* ============================================================================
   Praktik Mandiri Bidan - 03_stored_procedures.sql
   SQL Server 2025
   ----------------------------------------------------------------------------
   Isi   : 1 table-valued parameter (dbo.tvp_resep) + 6 stored procedure atomik.
   Sifat : idempotent (CREATE OR ALTER; tipe dijaga IF TYPE_ID(...) IS NULL).
   Pola  : SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRY BEGIN TRAN ... COMMIT
           END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; THROW; END CATCH.
   Error : THROW 50xxx, N'ERR-XXX-NN|<pesan Indonesia>', 1
           50001 RSV-01  50002 RSV-02  50003 RSV-03  50004 RSV-04  50005 RSV-05
           50006 RME-01  50007 RME-02  50008 RME-04  50009 INV-01  50010 INV-02
           50011 FIN-01  50012 FIN-02  50013 PRC-01  50014 VAL-01
   Audit : SESSION_CONTEXT(N'user_id')/N'ip' ditetapkan middleware aplikasi sebelum
           DML (lihat 04_triggers.sql); SP tidak menimpanya.
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
   dbo.tvp_resep - baris resep dari aplikasi (dapat berisi duplikat item_id;
   sp_simpan_kunjungan mengagregasi dengan SUM(jumlah) sebelum validasi).
   ============================================================================ */
IF TYPE_ID(N'dbo.tvp_resep') IS NULL
    CREATE TYPE dbo.tvp_resep AS TABLE
    (
        item_id      UNIQUEIDENTIFIER NOT NULL,
        jumlah       DECIMAL(10, 2)   NOT NULL,
        aturan_pakai NVARCHAR(100)    NULL
    );
GO

/* ============================================================================
   1. sp_buat_reservasi - pendaftaran online / walk-in + alokasi antrean
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_buat_reservasi
    @pasien_id     UNIQUEIDENTIFIER = NULL,
    @nik           CHAR(16)         = NULL,
    @nama          NVARCHAR(100)    = NULL,
    @tgl_lahir     DATE             = NULL,
    @alamat        NVARCHAR(255)    = NULL,
    @no_telepon    NVARCHAR(20)     = NULL,
    @sesi_id       UNIQUEIDENTIFIER,
    @layanan_id    UNIQUEIDENTIFIER,
    @metode_daftar VARCHAR(20)      = 'ONLINE',
    @dibuat_oleh   UNIQUEIDENTIFIER = NULL,
    @ip            VARCHAR(45)      = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @hari_ini      DATE     = CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE);
    DECLARE @sekarang      TIME(0)  = CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS TIME(0));
    DECLARE @reservasi_id  UNIQUEIDENTIFIER = NEWID();
    DECLARE @nomor         INT;
    DECLARE @estimasi      TIME(0);
    DECLARE @terpakai      INT;

    DECLARE @sesi_tanggal  DATE;
    DECLARE @jam_mulai     TIME(0);
    DECLARE @jam_selesai   TIME(0);
    DECLARE @kuota         INT;
    DECLARE @sesi_active   BIT;

    DECLARE @pid           UNIQUEIDENTIFIER;
    DECLARE @pactive       BIT;

    BEGIN TRY
        BEGIN TRAN;


        /* --- validasi parameter dasar --- */
        IF @metode_daftar IS NULL OR @metode_daftar NOT IN ('ONLINE', 'MANUAL_ADMIN')
            THROW 50014, N'ERR-VAL-01|Metode pendaftaran tidak valid.', 1;

        IF @sesi_id IS NULL OR @layanan_id IS NULL
            THROW 50014, N'ERR-VAL-01|Sesi dan layanan wajib diisi.', 1;

        IF @pasien_id IS NULL
        BEGIN
            IF @nik IS NULL
                THROW 50014, N'ERR-VAL-01|Pasien atau NIK wajib diisi.', 1;
            IF LEN(LTRIM(RTRIM(@nik))) <> 16 OR LTRIM(RTRIM(@nik)) LIKE '%[^0-9]%'
                THROW 50014, N'ERR-VAL-01|NIK harus 16 digit angka.', 1;
        END;

        /* --- kunci sesi (serialisasi kuota + antrean) --- */
        SELECT @sesi_tanggal = s.tanggal,
               @jam_mulai    = s.jam_mulai,
               @jam_selesai  = s.jam_selesai,
               @kuota        = s.kuota_maks,
               @sesi_active  = s.is_active
        FROM dbo.sesi_praktik AS s WITH (UPDLOCK, HOLDLOCK)
        WHERE s.sesi_id = @sesi_id;

        IF @sesi_tanggal IS NULL
            THROW 50005, N'ERR-RSV-05|Sesi praktik tidak ditemukan.', 1;

        IF @sesi_active = 0
           OR @sesi_tanggal < @hari_ini
           OR (@sesi_tanggal = @hari_ini AND @sekarang >= @jam_selesai)
            THROW 50005, N'ERR-RSV-05|Sesi praktik tidak aktif atau di luar jam praktik.', 1;

        IF NOT EXISTS (
            SELECT 1 FROM dbo.layanan AS l
            WHERE l.layanan_id = @layanan_id AND l.is_active = 1
        )
            THROW 50014, N'ERR-VAL-01|Layanan tidak ditemukan atau tidak aktif.', 1;

        /* --- resolusi pasien: @pasien_id atau NIK yang sudah terdaftar --- */
        IF @pasien_id IS NOT NULL
        BEGIN
            SET @pid = NULL;
            SET @pactive = NULL;
            SELECT @pid = p.pasien_id, @pactive = p.is_active
            FROM dbo.pasien AS p WITH (UPDLOCK, HOLDLOCK)
            WHERE p.pasien_id = @pasien_id;

            IF @pid IS NULL
                THROW 50006, N'ERR-RME-01|Pasien tidak ditemukan.', 1;
            IF @pactive = 0
                THROW 50014, N'ERR-VAL-01|Pasien tidak aktif.', 1;
        END
        ELSE
        BEGIN
            SET @pid = NULL;
            SET @pactive = NULL;
            SELECT @pid = p.pasien_id, @pactive = p.is_active
            FROM dbo.pasien AS p WITH (UPDLOCK, HOLDLOCK)
            WHERE p.nik = @nik;

            IF @pid IS NOT NULL AND @pactive = 0
                THROW 50014, N'ERR-VAL-01|Pasien tidak aktif.', 1;

            IF @pid IS NULL
            BEGIN
                IF @nama IS NULL OR @tgl_lahir IS NULL OR @no_telepon IS NULL
                    THROW 50014, N'ERR-VAL-01|Data pasien baru (nama, tgl_lahir, no_telepon) wajib diisi.', 1;

                SET @pid = NEWID();
                INSERT INTO dbo.pasien (pasien_id, nik, nama, tgl_lahir, alamat, no_telepon)
                VALUES (@pid, @nik, @nama, @tgl_lahir, @alamat, @no_telepon);
            END;
        END;

        /* --- satu reservasi aktif per pasien per sesi --- */
        IF EXISTS (
            SELECT 1 FROM dbo.reservasi AS r WITH (UPDLOCK, HOLDLOCK)
            WHERE r.pasien_id = @pid
              AND r.sesi_id = @sesi_id
              AND r.status <> 'DIBATALKAN'
        )
            THROW 50002, N'ERR-RSV-02|Pasien sudah memiliki reservasi aktif pada sesi ini.', 1;

        /* --- kuota --- */
        SELECT @terpakai = COUNT(*)
        FROM dbo.reservasi AS r WITH (UPDLOCK, HOLDLOCK)
        WHERE r.sesi_id = @sesi_id
          AND r.status <> 'DIBATALKAN';

        IF @terpakai >= @kuota
            THROW 50001, N'ERR-RSV-01|Kuota sesi sudah penuh.', 1;

        /* --- alokasi nomor antrean dari baris aktif saja --- */
        SELECT @nomor = ISNULL(MAX(r.nomor_antrean), 0) + 1
        FROM dbo.reservasi AS r WITH (UPDLOCK, HOLDLOCK)
        WHERE r.sesi_id = @sesi_id
          AND r.status <> 'DIBATALKAN';

        SET @estimasi = dbo.fn_hitung_estimasi_jam(@sesi_id, @nomor);
        IF @estimasi IS NULL
            SET @estimasi = @jam_mulai;

        INSERT INTO dbo.reservasi
            (reservasi_id, pasien_id, sesi_id, layanan_id, nomor_antrean,
             estimasi_jam, metode_daftar, status, dibuat_oleh)
        VALUES
            (@reservasi_id, @pid, @sesi_id, @layanan_id, @nomor,
             @estimasi, @metode_daftar, 'MENUNGGU', @dibuat_oleh);

        COMMIT;

        SELECT @reservasi_id AS reservasi_id,
               @nomor        AS nomor_antrean,
               @estimasi     AS estimasi_jam;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO

/* ============================================================================
   2. sp_reschedule_reservasi - pindah jadwal atau batalkan + rapikan antrean
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_reschedule_reservasi
    @reservasi_id UNIQUEIDENTIFIER,
    @sesi_baru    UNIQUEIDENTIFIER = NULL,
    @alasan       NVARCHAR(255),
    @user_id      UNIQUEIDENTIFIER,
    @ip           VARCHAR(45)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @hari_ini     DATE    = CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE);
    DECLARE @sekarang     TIME(0) = CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS TIME(0));

    DECLARE @sesi_asal    UNIQUEIDENTIFIER;
    DECLARE @pasien_id    UNIQUEIDENTIFIER;
    DECLARE @status       VARCHAR(20);

    DECLARE @tgl_target   DATE;
    DECLARE @mulai_target TIME(0);
    DECLARE @selesai_target TIME(0);
    DECLARE @kuota_target INT;
    DECLARE @target_active BIT;
    DECLARE @nomor_baru   INT;
    DECLARE @estimasi     TIME(0);
    DECLARE @terpakai     INT;

    DECLARE @lock_id      UNIQUEIDENTIFIER;
    DECLARE @dummy        UNIQUEIDENTIFIER;
    DECLARE @lock_order   TABLE (sesi_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY);

    BEGIN TRY
        BEGIN TRAN;


        IF @reservasi_id IS NULL
            THROW 50014, N'ERR-VAL-01|Reservasi wajib diisi.', 1;

        /* Baca identitas sesi asal tanpa lock, lalu kunci sesi secara berurutan
           (GUID menaik) agar tidak deadlock dengan alokasi antrean lain. */
        SELECT @sesi_asal = r.sesi_id, @pasien_id = r.pasien_id
        FROM dbo.reservasi AS r
        WHERE r.reservasi_id = @reservasi_id;

        IF @sesi_asal IS NULL
            THROW 50003, N'ERR-RSV-03|Reservasi tidak ditemukan.', 1;

        INSERT INTO @lock_order (sesi_id) VALUES (@sesi_asal);
        IF @sesi_baru IS NOT NULL AND @sesi_baru <> @sesi_asal
            INSERT INTO @lock_order (sesi_id) VALUES (@sesi_baru);

        DECLARE cur_lock CURSOR LOCAL FAST_FORWARD FOR
            SELECT sesi_id FROM @lock_order ORDER BY sesi_id;
        OPEN cur_lock;
        FETCH NEXT FROM cur_lock INTO @lock_id;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @dummy = NULL;
            SELECT @dummy = s.sesi_id
            FROM dbo.sesi_praktik AS s WITH (UPDLOCK, HOLDLOCK)
            WHERE s.sesi_id = @lock_id;
            FETCH NEXT FROM cur_lock INTO @lock_id;
        END;
        CLOSE cur_lock;
        DEALLOCATE cur_lock;

        /* Kunci baris reservasi dan baca ulang setelah semua lock sesi didapat. */
        SET @status = NULL;
        SELECT @status = r.status
        FROM dbo.reservasi AS r WITH (UPDLOCK, HOLDLOCK)
        WHERE r.reservasi_id = @reservasi_id;

        IF @status IS NULL
            THROW 50003, N'ERR-RSV-03|Reservasi tidak ditemukan.', 1;
        IF @status IN ('DIBATALKAN', 'SELESAI')
            THROW 50004, N'ERR-RSV-04|Reservasi dengan status ini tidak dapat diubah.', 1;

        IF @sesi_baru IS NULL
        BEGIN
            /* Pembatalan saja. */
            UPDATE dbo.reservasi
            SET status = 'DIBATALKAN',
                alasan_batal = @alasan,
                updated_at = SYSDATETIME()
            WHERE reservasi_id = @reservasi_id;
        END
        ELSE
        BEGIN
            IF @sesi_baru = @sesi_asal
                THROW 50014, N'ERR-VAL-01|Sesi tujuan sama dengan sesi asal.', 1;

            SET @tgl_target = NULL;
            SET @target_active = NULL;
            SELECT @tgl_target = s.tanggal,
                   @mulai_target = s.jam_mulai,
                   @selesai_target = s.jam_selesai,
                   @kuota_target = s.kuota_maks,
                   @target_active = s.is_active
            FROM dbo.sesi_praktik AS s
            WHERE s.sesi_id = @sesi_baru;

            IF @tgl_target IS NULL
                THROW 50005, N'ERR-RSV-05|Sesi praktik tujuan tidak ditemukan.', 1;
            IF @target_active = 0
               OR @tgl_target < @hari_ini
               OR (@tgl_target = @hari_ini AND @sekarang >= @selesai_target)
                THROW 50005, N'ERR-RSV-05|Sesi praktik tujuan tidak aktif atau di luar jam praktik.', 1;

            IF EXISTS (
                SELECT 1 FROM dbo.reservasi AS r WITH (UPDLOCK, HOLDLOCK)
                WHERE r.pasien_id = @pasien_id
                  AND r.sesi_id = @sesi_baru
                  AND r.status <> 'DIBATALKAN'
                  AND r.reservasi_id <> @reservasi_id
            )
                THROW 50002, N'ERR-RSV-02|Pasien sudah memiliki reservasi aktif pada sesi tujuan.', 1;

            SELECT @terpakai = COUNT(*)
            FROM dbo.reservasi AS r WITH (UPDLOCK, HOLDLOCK)
            WHERE r.sesi_id = @sesi_baru
              AND r.status <> 'DIBATALKAN';

            IF @terpakai >= @kuota_target
                THROW 50001, N'ERR-RSV-01|Kuota sesi tujuan sudah penuh.', 1;

            SELECT @nomor_baru = ISNULL(MAX(r.nomor_antrean), 0) + 1
            FROM dbo.reservasi AS r WITH (UPDLOCK, HOLDLOCK)
            WHERE r.sesi_id = @sesi_baru
              AND r.status <> 'DIBATALKAN';

            SET @estimasi = dbo.fn_hitung_estimasi_jam(@sesi_baru, @nomor_baru);
            IF @estimasi IS NULL
                SET @estimasi = @mulai_target;

            UPDATE dbo.reservasi
            SET sesi_id = @sesi_baru,
                nomor_antrean = @nomor_baru,
                estimasi_jam = @estimasi,
                updated_at = SYSDATETIME()
            WHERE reservasi_id = @reservasi_id;
        END;

        /* Rapikan antrean sesi asal: dua fase wajib karena filtered unique index
           (sesi_id, nomor_antrean) WHERE status <> 'DIBATALKAN'. */
        UPDATE dbo.reservasi
        SET nomor_antrean = nomor_antrean + 1000
        WHERE sesi_id = @sesi_asal
          AND status <> 'DIBATALKAN';

        ;WITH urut AS (
            SELECT reservasi_id,
                   ROW_NUMBER() OVER (ORDER BY nomor_antrean) AS rn
            FROM dbo.reservasi
            WHERE sesi_id = @sesi_asal
              AND status <> 'DIBATALKAN'
        )
        UPDATE r
        SET r.nomor_antrean = u.rn,
            r.estimasi_jam = dbo.fn_hitung_estimasi_jam(r.sesi_id, u.rn),
            r.updated_at = SYSDATETIME()
        FROM dbo.reservasi AS r
        JOIN urut AS u ON u.reservasi_id = r.reservasi_id;

        COMMIT;

        SELECT r.reservasi_id, r.nomor_antrean, r.estimasi_jam, r.status
        FROM dbo.reservasi AS r
        WHERE r.reservasi_id = @reservasi_id;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO

/* ============================================================================
   3. sp_simpan_kunjungan - RME + resep + stok + tagihan dalam satu transaksi
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_simpan_kunjungan
    @pasien_id          UNIQUEIDENTIFIER,
    @reservasi_id       UNIQUEIDENTIFIER = NULL,
    @bidan_id           UNIQUEIDENTIFIER,
    @layanan_id         UNIQUEIDENTIFIER,
    @tanggal_kunjungan  DATETIME2,
    @keluhan            NVARCHAR(MAX),
    @pemeriksaan_fisik  NVARCHAR(MAX),
    @diagnosis          NVARCHAR(MAX),
    @tindakan           NVARCHAR(MAX),
    @catatan_bebas      NVARCHAR(MAX) = NULL,
    @koreksi_dari_id    UNIQUEIDENTIFIER = NULL,
    @resep              dbo.tvp_resep READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @kunjungan_id   UNIQUEIDENTIFIER = NEWID();
    DECLARE @tagihan_id     UNIQUEIDENTIFIER = NEWID();
    DECLARE @tgl            DATE;
    DECLARE @harga_layanan  DECIMAL(18, 2);
    DECLARE @total          DECIMAL(18, 2);
    DECLARE @msg            NVARCHAR(2048);
    DECLARE @item_tanpa_harga NVARCHAR(100);

    DECLARE @res_pasien     UNIQUEIDENTIFIER;
    DECLARE @res_status     VARCHAR(20);

    DECLARE @iid            UNIQUEIDENTIFIER;
    DECLARE @iqty           DECIMAL(10, 2);
    DECLARE @stok_item      DECIMAL(10, 2);
    DECLARE @nama_item      NVARCHAR(100);

    DECLARE @items TABLE
    (
        item_id      UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        jumlah       DECIMAL(10, 2)   NOT NULL,
        aturan_pakai NVARCHAR(100)    NULL
    );

    DECLARE @harga TABLE
    (
        item_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        harga   DECIMAL(18, 2)   NULL
    );

    BEGIN TRY
        BEGIN TRAN;


        /* --- validasi dasar --- */
        IF @pasien_id IS NULL OR @bidan_id IS NULL OR @layanan_id IS NULL
           OR @tanggal_kunjungan IS NULL
            THROW 50014, N'ERR-VAL-01|Pasien, bidan, layanan, dan tanggal kunjungan wajib diisi.', 1;

        IF NOT EXISTS (SELECT 1 FROM dbo.pasien WHERE pasien_id = @pasien_id)
            THROW 50006, N'ERR-RME-01|Pasien tidak ditemukan.', 1;

        IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @bidan_id)
            THROW 50014, N'ERR-VAL-01|Bidan tidak ditemukan.', 1;

        IF @koreksi_dari_id IS NOT NULL
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM dbo.kunjungan WHERE kunjungan_id = @koreksi_dari_id)
                THROW 50007, N'ERR-RME-02|Kunjungan yang dikoreksi tidak ditemukan.', 1;
            IF NOT EXISTS (
                SELECT 1 FROM dbo.kunjungan
                WHERE kunjungan_id = @koreksi_dari_id AND pasien_id = @pasien_id
            )
                THROW 50014, N'ERR-VAL-01|Kunjungan koreksi bukan milik pasien ini.', 1;
        END;

        IF @reservasi_id IS NOT NULL
        BEGIN
            SET @res_pasien = NULL;
            SET @res_status = NULL;
            SELECT @res_pasien = r.pasien_id, @res_status = r.status
            FROM dbo.reservasi AS r WITH (UPDLOCK, HOLDLOCK)
            WHERE r.reservasi_id = @reservasi_id;

            IF @res_pasien IS NULL
                THROW 50003, N'ERR-RSV-03|Reservasi tidak ditemukan.', 1;
            IF @res_pasien <> @pasien_id
                THROW 50014, N'ERR-VAL-01|Reservasi bukan milik pasien ini.', 1;
            IF @res_status = 'DIBATALKAN'
                THROW 50004, N'ERR-RSV-04|Reservasi sudah dibatalkan.', 1;
        END;

        SET @tgl = CAST(@tanggal_kunjungan AS DATE);

        /* --- harga layanan wajib tersedia pada tanggal kunjungan --- */
        SET @harga_layanan = dbo.fn_harga_berlaku('LAYANAN', @layanan_id, @tgl);
        IF @harga_layanan IS NULL
            THROW 50013, N'ERR-PRC-01|Harga layanan belum ditetapkan untuk tanggal kunjungan.', 1;

        /* --- agregasi duplikat TVP SEBELUM validasi apa pun --- */
        IF EXISTS (SELECT 1 FROM @resep WHERE jumlah IS NULL OR jumlah <= 0)
            THROW 50014, N'ERR-VAL-01|Jumlah resep harus lebih dari nol.', 1;

        INSERT INTO @items (item_id, jumlah, aturan_pakai)
        SELECT r.item_id, SUM(r.jumlah), MAX(r.aturan_pakai)
        FROM @resep AS r
        GROUP BY r.item_id;

        /* --- tolak alergi obat (ERR-RME-04) --- */
        IF EXISTS (
            SELECT 1
            FROM @items AS x
            WHERE dbo.fn_cek_alergi(@pasien_id, x.item_id) = 1
        )
            THROW 50008, N'ERR-RME-04|Pasien memiliki alergi terhadap salah satu item resep.', 1;

        /* --- kunci item urut item_id menaik (hindari deadlock), cek stok --- */
        DECLARE cur_item CURSOR LOCAL FAST_FORWARD FOR
            SELECT item_id, jumlah FROM @items ORDER BY item_id;
        OPEN cur_item;
        FETCH NEXT FROM cur_item INTO @iid, @iqty;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @stok_item = NULL;
            SET @nama_item = NULL;
            SELECT @stok_item = i.stok, @nama_item = i.nama
            FROM dbo.item_inventaris AS i WITH (UPDLOCK, HOLDLOCK)
            WHERE i.item_id = @iid;

            IF @stok_item IS NULL
                THROW 50009, N'ERR-INV-01|Item inventaris tidak ditemukan.', 1;

            IF @stok_item < @iqty
            BEGIN
                SET @msg = N'ERR-INV-02|Stok ' + @nama_item + N' tidak cukup.';
                THROW 50010, @msg, 1;
            END;

            FETCH NEXT FROM cur_item INTO @iid, @iqty;
        END;
        CLOSE cur_item;
        DEALLOCATE cur_item;

        /* --- snapshot harga item pada tanggal kunjungan --- */
        INSERT INTO @harga (item_id, harga)
        SELECT x.item_id, dbo.fn_harga_berlaku('ITEM', x.item_id, @tgl)
        FROM @items AS x;

        SET @item_tanpa_harga = (
            SELECT TOP (1) i.nama
            FROM @harga AS h
            JOIN dbo.item_inventaris AS i ON i.item_id = h.item_id
            WHERE h.harga IS NULL
        );
        IF @item_tanpa_harga IS NOT NULL
        BEGIN
            SET @msg = N'ERR-PRC-01|Harga item ' + @item_tanpa_harga + N' belum ditetapkan untuk tanggal kunjungan.';
            THROW 50013, @msg, 1;
        END;

        /* --- RME append-only --- */
        INSERT INTO dbo.kunjungan
            (kunjungan_id, pasien_id, reservasi_id, bidan_id, layanan_id,
             tanggal_kunjungan, keluhan, pemeriksaan_fisik, diagnosis, tindakan,
             catatan_bebas, koreksi_dari_id)
        VALUES
            (@kunjungan_id, @pasien_id, @reservasi_id, @bidan_id, @layanan_id,
             @tanggal_kunjungan, @keluhan, @pemeriksaan_fisik, @diagnosis, @tindakan,
             @catatan_bebas, @koreksi_dari_id);

        INSERT INTO dbo.resep_item (kunjungan_id, item_id, jumlah, aturan_pakai)
        SELECT @kunjungan_id, x.item_id, x.jumlah, x.aturan_pakai
        FROM @items AS x;

        /* --- potong stok + catat mutasi PAKAI --- */
        UPDATE i
        SET i.stok = i.stok - x.jumlah,
            i.updated_at = SYSDATETIME()
        FROM dbo.item_inventaris AS i
        JOIN @items AS x ON x.item_id = i.item_id;

        INSERT INTO dbo.riwayat_stok (item_id, kunjungan_id, user_id, jenis, jumlah, keterangan)
        SELECT x.item_id, @kunjungan_id, @bidan_id, 'PAKAI', x.jumlah,
               N'Pemakaian resep kunjungan'
        FROM @items AS x;

        /* --- tagihan + rincian snapshot --- */
        SET @total = @harga_layanan + ISNULL((
            SELECT SUM(CAST(x.jumlah * h.harga AS DECIMAL(18, 2)))
            FROM @items AS x
            JOIN @harga AS h ON h.item_id = x.item_id
        ), 0);

        INSERT INTO dbo.tagihan (tagihan_id, kunjungan_id, total_tagihan, total_dibayar, status)
        VALUES (@tagihan_id, @kunjungan_id, @total, 0, 'BELUM_LUNAS');

        INSERT INTO dbo.tagihan_rincian (tagihan_id, layanan_id, qty, harga_satuan)
        VALUES (@tagihan_id, @layanan_id, 1, @harga_layanan);

        INSERT INTO dbo.tagihan_rincian (tagihan_id, item_id, qty, harga_satuan)
        SELECT @tagihan_id, x.item_id, x.jumlah, h.harga
        FROM @items AS x
        JOIN @harga AS h ON h.item_id = x.item_id;

        /* --- reservasi selesai bila kunjungan berasal dari reservasi --- */
        IF @reservasi_id IS NOT NULL
        BEGIN
            UPDATE dbo.reservasi
            SET status = 'SELESAI',
                updated_at = SYSDATETIME()
            WHERE reservasi_id = @reservasi_id
              AND status <> 'DIBATALKAN';
        END;

        COMMIT;

        SELECT @kunjungan_id AS kunjungan_id,
               @tagihan_id   AS tagihan_id,
               @total        AS total_tagihan;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO

/* ============================================================================
   4. sp_catat_pembayaran - cicilan / pelunasan
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_catat_pembayaran
    @tagihan_id   UNIQUEIDENTIFIER,
    @jumlah       DECIMAL(18, 2),
    @jalur        VARCHAR(20),
    @dicatat_oleh UNIQUEIDENTIFIER,
    @ip           VARCHAR(45)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @total_tagihan DECIMAL(18, 2);
    DECLARE @total_dibayar DECIMAL(18, 2);
    DECLARE @total_baru    DECIMAL(18, 2);
    DECLARE @status        VARCHAR(20);

    BEGIN TRY
        BEGIN TRAN;


        IF @tagihan_id IS NULL
            THROW 50014, N'ERR-VAL-01|Tagihan wajib diisi.', 1;
        IF @jumlah IS NULL OR @jumlah <= 0
            THROW 50014, N'ERR-VAL-01|Jumlah pembayaran harus lebih dari nol.', 1;
        IF @jalur IS NULL OR @jalur NOT IN ('MANDIRI', 'BPJS', 'ASURANSI')
            THROW 50014, N'ERR-VAL-01|Jalur pembayaran tidak valid.', 1;

        SET @total_tagihan = NULL;
        SET @total_dibayar = NULL;
        SELECT @total_tagihan = t.total_tagihan,
               @total_dibayar = t.total_dibayar
        FROM dbo.tagihan AS t WITH (UPDLOCK, HOLDLOCK)
        WHERE t.tagihan_id = @tagihan_id;

        IF @total_tagihan IS NULL
            THROW 50011, N'ERR-FIN-01|Tagihan tidak ditemukan.', 1;

        IF @jumlah > @total_tagihan - @total_dibayar
            THROW 50012, N'ERR-FIN-02|Pembayaran melebihi sisa tagihan.', 1;

        SET @total_baru = @total_dibayar + @jumlah;
        SET @status = CASE WHEN @total_baru >= @total_tagihan THEN 'LUNAS' ELSE 'BELUM_LUNAS' END;

        INSERT INTO dbo.pembayaran (tagihan_id, jumlah, jalur, dicatat_oleh)
        VALUES (@tagihan_id, @jumlah, @jalur, @dicatat_oleh);

        UPDATE dbo.tagihan
        SET total_dibayar = @total_baru,
            status = @status,
            updated_at = SYSDATETIME()
        WHERE tagihan_id = @tagihan_id;

        COMMIT;

        SELECT @tagihan_id    AS tagihan_id,
               @total_tagihan AS total_tagihan,
               @total_baru    AS total_dibayar,
               @status        AS status;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO

/* ============================================================================
   5. sp_restock_item - tambah stok + catat mutasi RESTOCK
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_restock_item
    @item_id         UNIQUEIDENTIFIER,
    @jumlah          DECIMAL(10, 2),
    @harga_beli      DECIMAL(18, 2) = NULL,
    @tgl_kedaluwarsa DATE           = NULL,
    @user_id         UNIQUEIDENTIFIER,
    @ip              VARCHAR(45)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @stok   DECIMAL(10, 2);
    DECLARE @msg    NVARCHAR(2048);

    BEGIN TRY
        BEGIN TRAN;


        IF @item_id IS NULL
            THROW 50014, N'ERR-VAL-01|Item wajib diisi.', 1;
        IF @jumlah IS NULL OR @jumlah <= 0
            THROW 50014, N'ERR-VAL-01|Jumlah restock harus lebih dari nol.', 1;
        IF @harga_beli IS NOT NULL AND @harga_beli < 0
            THROW 50014, N'ERR-VAL-01|Harga beli tidak boleh negatif.', 1;

        SET @stok = NULL;
        SELECT @stok = i.stok
        FROM dbo.item_inventaris AS i WITH (UPDLOCK, HOLDLOCK)
        WHERE i.item_id = @item_id;

        IF @stok IS NULL
            THROW 50009, N'ERR-INV-01|Item inventaris tidak ditemukan.', 1;

        UPDATE dbo.item_inventaris
        SET stok = stok + @jumlah,
            tgl_kedaluwarsa = ISNULL(@tgl_kedaluwarsa, tgl_kedaluwarsa),
            updated_at = SYSDATETIME()
        WHERE item_id = @item_id;

        SET @msg = N'Restock';
        IF @harga_beli IS NOT NULL
            SET @msg = @msg + N'; harga beli: ' + CONVERT(NVARCHAR(30), CAST(@harga_beli AS DECIMAL(18, 2)));

        INSERT INTO dbo.riwayat_stok (item_id, user_id, jenis, jumlah, keterangan)
        VALUES (@item_id, @user_id, 'RESTOCK', @jumlah, @msg);

        COMMIT;

        SELECT i.item_id, i.stok
        FROM dbo.item_inventaris AS i
        WHERE i.item_id = @item_id;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO

/* ============================================================================
   6. sp_ubah_harga - tutup harga terbuka lalu sisipkan harga baru (append-only)
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_ubah_harga
    @ref_tipe    VARCHAR(10),
    @ref_id      UNIQUEIDENTIFIER,
    @harga       DECIMAL(18, 2),
    @berlaku_dari DATE,
    @alasan      NVARCHAR(255),
    @diubah_oleh UNIQUEIDENTIFIER,
    @ip          VARCHAR(45)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @harga_id    UNIQUEIDENTIFIER = NEWID();
    DECLARE @open_start  DATE;
    DECLARE @item_id     UNIQUEIDENTIFIER;
    DECLARE @layanan_id  UNIQUEIDENTIFIER;

    BEGIN TRY
        BEGIN TRAN;


        IF @ref_tipe IS NULL OR @ref_tipe NOT IN ('ITEM', 'LAYANAN')
            THROW 50014, N'ERR-VAL-01|Referensi harga harus ITEM atau LAYANAN.', 1;
        IF @ref_id IS NULL OR @berlaku_dari IS NULL
            THROW 50014, N'ERR-VAL-01|Referensi dan tanggal berlaku wajib diisi.', 1;
        IF @harga IS NULL OR @harga < 0
            THROW 50013, N'ERR-PRC-01|Harga tidak valid.', 1;

        IF @ref_tipe = 'ITEM'
        BEGIN
            SET @item_id = @ref_id;
            IF NOT EXISTS (
                SELECT 1 FROM dbo.item_inventaris AS i WITH (UPDLOCK, HOLDLOCK)
                WHERE i.item_id = @ref_id
            )
                THROW 50009, N'ERR-INV-01|Item inventaris tidak ditemukan.', 1;
        END
        ELSE
        BEGIN
            SET @layanan_id = @ref_id;
            IF NOT EXISTS (
                SELECT 1 FROM dbo.layanan AS l WITH (UPDLOCK, HOLDLOCK)
                WHERE l.layanan_id = @ref_id
            )
                THROW 50014, N'ERR-VAL-01|Layanan tidak ditemukan.', 1;
        END;

        /* Kunci seluruh baris harga referensi ini. */
        SET @open_start = NULL;
        SELECT @open_start = MAX(h.berlaku_dari)
        FROM dbo.riwayat_harga AS h WITH (UPDLOCK, HOLDLOCK)
        WHERE (
                (@ref_tipe = 'ITEM'    AND h.item_id = @ref_id)
             OR (@ref_tipe = 'LAYANAN' AND h.layanan_id = @ref_id)
              )
          AND h.berlaku_sampai IS NULL;

        /* Tanggal duplikat / tanggal yang mendahului harga aktif ditolak. */
        IF EXISTS (
            SELECT 1
            FROM dbo.riwayat_harga AS h
            WHERE (
                    (@ref_tipe = 'ITEM'    AND h.item_id = @ref_id)
                 OR (@ref_tipe = 'LAYANAN' AND h.layanan_id = @ref_id)
                  )
              AND h.berlaku_dari = @berlaku_dari
        )
            THROW 50013, N'ERR-PRC-01|Harga untuk tanggal berlaku tersebut sudah ada.', 1;

        IF @open_start IS NOT NULL AND @berlaku_dari <= @open_start
            THROW 50013, N'ERR-PRC-01|Tanggal berlaku harus setelah harga aktif saat ini.', 1;

        /* Tutup harga terbuka sehari sebelum tanggal berlaku baru. */
        UPDATE dbo.riwayat_harga
        SET berlaku_sampai = DATEADD(DAY, -1, @berlaku_dari)
        WHERE (
                (@ref_tipe = 'ITEM'    AND item_id = @ref_id)
             OR (@ref_tipe = 'LAYANAN' AND layanan_id = @ref_id)
              )
          AND berlaku_sampai IS NULL;

        INSERT INTO dbo.riwayat_harga
            (harga_id, ref_tipe, item_id, layanan_id, harga, berlaku_dari,
             berlaku_sampai, alasan, diubah_oleh)
        VALUES
            (@harga_id, @ref_tipe, @item_id, @layanan_id, @harga, @berlaku_dari,
             NULL, @alasan, @diubah_oleh);

        COMMIT;

        SELECT @harga_id AS harga_id, @berlaku_dari AS berlaku_dari;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO
