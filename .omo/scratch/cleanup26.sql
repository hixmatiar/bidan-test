-- Removes every scratch row created by the task-26 live check.
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DELETE FROM dbo.riwayat_harga
WHERE item_id = 'A1260000-0000-4000-8000-000000000026'
   OR layanan_id = 'B2260000-0000-4000-8000-000000000026';

DELETE FROM dbo.item_inventaris
WHERE item_id = 'A1260000-0000-4000-8000-000000000026';

DELETE FROM dbo.layanan
WHERE layanan_id = 'B2260000-0000-4000-8000-000000000026';

COMMIT;

SELECT 'harga_rows', COUNT(*) FROM dbo.riwayat_harga;
SELECT 'open_rows', COUNT(*) FROM dbo.riwayat_harga WHERE berlaku_sampai IS NULL;
SELECT 'closed_rows', COUNT(*) FROM dbo.riwayat_harga WHERE berlaku_sampai IS NOT NULL;
SELECT 'items', COUNT(*) FROM dbo.item_inventaris;
SELECT 'layanan', COUNT(*) FROM dbo.layanan;
SELECT 'scratch_left', COUNT(*) FROM dbo.riwayat_harga
WHERE item_id = 'A1260000-0000-4000-8000-000000000026'
   OR layanan_id = 'B2260000-0000-4000-8000-000000000026';
SELECT 'seed_rows', ref_tipe, COUNT(*), CAST(MIN(berlaku_dari) AS VARCHAR(10)), SUM(CASE WHEN berlaku_sampai IS NULL THEN 1 ELSE 0 END)
FROM dbo.riwayat_harga GROUP BY ref_tipe;
