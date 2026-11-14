-- Scratch data for the task-26 live check (deleted again by cleanup26.sql).
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @item UNIQUEIDENTIFIER = 'A1260000-0000-4000-8000-000000000026';
DECLARE @admin UNIQUEIDENTIFIER = '3FCB423E-F36B-1410-864C-00CA0D54CA7B';

IF NOT EXISTS (SELECT 1 FROM dbo.item_inventaris WHERE item_id = @item)
BEGIN
    INSERT INTO dbo.item_inventaris (item_id, nama, kategori, satuan, stok, stok_minimum)
    VALUES (@item, N'ZZ Scratch Item Task 26', 'OBAT', 'tablet', 10, 5);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.riwayat_harga WHERE item_id = @item AND berlaku_sampai IS NULL)
BEGIN
    INSERT INTO dbo.riwayat_harga (ref_tipe, item_id, harga, berlaku_dari, berlaku_sampai, alasan, diubah_oleh)
    VALUES ('ITEM', @item, 1000.00, '2026-11-14', NULL, N'Harga awal scratch task 26', @admin);
END;

SELECT item_id, nama FROM dbo.item_inventaris WHERE item_id = @item;
SELECT harga_id, ref_tipe, item_id, harga, berlaku_dari, berlaku_sampai, alasan
FROM dbo.riwayat_harga WHERE item_id = @item ORDER BY berlaku_dari;
