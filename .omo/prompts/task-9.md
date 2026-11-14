# Assignment: plan checkbox 9

Repository: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan (current dir).
Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read first
1. Plan checkbox 9 (full paragraph; it is long — use `python3 -c` to print line 277 without truncation if your Read tool cuts it).
2. `backend/database/01_schema.sql`, `02_functions_views.sql` (all executed live).
3. `TSD.md` lines 207-213; draft decisions 10-14.

## Implement exactly checkbox 9
Create `backend/database/03_stored_procedures.sql`:
- `CREATE OR ALTER TYPE dbo.tvp_resep AS TABLE (item_id UNIQUEIDENTIFIER NOT NULL, jumlah DECIMAL(10,2) NOT NULL, aturan_pakai NVARCHAR(100) NULL);` guarded by `IF TYPE_ID(...) IS NULL`.
- 6 procedures (`CREATE OR ALTER PROCEDURE`), each `SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRY BEGIN TRAN ... COMMIT END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`:
  - `sp_buat_reservasi @pasien_id UNIQUEIDENTIFIER=NULL, @nik CHAR(16)=NULL, @nama NVARCHAR(100)=NULL, @tgl_lahir DATE=NULL, @alamat NVARCHAR(255)=NULL, @no_telepon NVARCHAR(20)=NULL, @sesi_id UNIQUEIDENTIFIER, @layanan_id UNIQUEIDENTIFIER, @metode_daftar VARCHAR(20)='ONLINE', @dibuat_oleh UNIQUEIDENTIFIER=NULL, @ip VARCHAR(45)=NULL` → `(reservasi_id, nomor_antrean, estimasi_jam)`. Validate active/future session + quota; reuse patient by @pasien_id or matching @nik (never duplicate a NIK); reject duplicate active reservation; allocate antrean under `WITH (UPDLOCK, HOLDLOCK)` from active rows only.
  - `sp_reschedule_reservasi @reservasi_id UNIQUEIDENTIFIER, @sesi_baru UNIQUEIDENTIFIER=NULL, @alasan NVARCHAR(255), @user_id UNIQUEIDENTIFIER, @ip VARCHAR(45)` → `(reservasi_id, nomor_antrean, estimasi_jam, status)`. Cancel or move; renumber the ORIGIN session's remaining active rows to 1..N in TWO PHASES (`nomor_antrean = nomor_antrean + 1000`, then `ROW_NUMBER()` final values); recompute estimasi_jam.
  - `sp_simpan_kunjungan @pasien_id UNIQUEIDENTIFIER, @reservasi_id UNIQUEIDENTIFIER=NULL, @bidan_id UNIQUEIDENTIFIER, @layanan_id UNIQUEIDENTIFIER, @tanggal_kunjungan DATETIME2, @keluhan NVARCHAR(MAX), @pemeriksaan_fisik NVARCHAR(MAX), @diagnosis NVARCHAR(MAX), @tindakan NVARCHAR(MAX), @catatan_bebas NVARCHAR(MAX)=NULL, @koreksi_dari_id UNIQUEIDENTIFIER=NULL, @resep dbo.tvp_resep READONLY` → `(kunjungan_id, tagihan_id, total_tagihan)`. Validate patient/layanan price; aggregate duplicate TVP rows by item_id (SUM jumlah) BEFORE checks; reject any aggregated item with `dbo.fn_cek_alergi(@pasien_id, item_id)=1` (ERR-RME-04); lock items in ascending item_id order (deadlock avoidance); reject insufficient stock; insert kunjungan + resep_item; deduct stock; insert riwayat_stok PAKAI; create tagihan + rincian (layanan qty 1 + each item qty) using `fn_harga_berlaku` snapshots; mark reservasi SELESAI when given.
  - `sp_catat_pembayaran @tagihan_id, @jumlah DECIMAL(18,2), @jalur VARCHAR(20), @dicatat_oleh UNIQUEIDENTIFIER, @ip VARCHAR(45)` → `(tagihan_id, total_tagihan, total_dibayar, status)`. Lock bill, reject overpayment, insert, update totals/status.
  - `sp_restock_item @item_id, @jumlah DECIMAL(10,2), @harga_beli DECIMAL(18,2)=NULL, @tgl_kedaluwarsa DATE=NULL, @user_id, @ip` → `(item_id, stok)`. Update stock + optional expiry, insert RESTOCK.
  - `sp_ubah_harga @ref_tipe VARCHAR(10), @ref_id UNIQUEIDENTIFIER, @harga DECIMAL(18,2), @berlaku_dari DATE, @alasan NVARCHAR(255), @diubah_oleh UNIQUEIDENTIFIER, @ip VARCHAR(45)` → `(harga_id, berlaku_dari)`. Validate, close the open price at `DATEADD(day,-1,@berlaku_dari)`, insert new row.
  - No read-only SPs.
- Business errors exactly: `THROW 50001, N'ERR-RSV-01|<message>', 1` ... mapping 50001 RSV-01, 50002 RSV-02, 50003 RSV-03, 50004 RSV-04, 50005 RSV-05, 50006 RME-01, 50007 RME-02, 50008 RME-04, 50009 INV-01, 50010 INV-02, 50011 FIN-01, 50012 FIN-02, 50013 PRC-01, 50014 VAL-01. Messages in Indonesian.

Constraints:
- Do NOT modify 01/02 SQL, triggers, seed, TS files, plan, or `.omo/`.
- SQL Server 2025 syntax; `-I` (QUOTED_IDENTIFIER ON) required.

## Verify (must actually run)
Host has no sqlcmd. `P=$(docker inspect sql_server_pikachen --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MSSQL_SA_PASSWORD=//p')`, then
`docker exec -i sql_server_pikachen /opt/mssql-tools18/bin/sqlcmd -I -C -S localhost -U sa -P "$P" -d PraktikBidan -b < backend/database/03_stored_procedures.sql`. Do NOT print the password.
1. Run twice, both exit 0.
2. `SELECT COUNT(*) FROM sys.procedures WHERE name LIKE 'sp[_]%'` = 6; `SELECT COUNT(*) FROM sys.types WHERE name='tvp_resep'` = 1.
3. Real QA inside transactions you roll back (users table is empty before seed, so create scratch rows):
   - book beyond quota → message starts `ERR-RSV-01|`;
   - overpay → `ERR-FIN-02|`;
   - allergic item (scratch alergi_kondisi) → `ERR-RME-04|`;
   - insufficient stock → `ERR-INV-02|`;
   - two reservations, then reschedule one → origin queue numbers contiguous 1..N and estimasi_jam recomputed.
   Roll back everything.
4. Note: the seed (task 11) may run concurrently; if a QA needs prices, insert scratch `riwayat_harga` rows inside your transaction.

## Record and commit
- Append real output to `.omo/evidence/task-9-praktik-bidan-monorepo.txt`.
- Commit only the SQL file: `git add backend/database/03_stored_procedures.sql && git commit -m "feat(db): add atomic stored procedures and resep TVP"`. Retry up to 3 times on git lock.

## Finish
Print `DONE_TASK_9` on its own line, then a DoneClaim JSON (changed_files, tests command+result, manual_qa artifact, cleanup, risks).