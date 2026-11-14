SET NOCOUNT ON;
INSERT INTO dbo.pasien (pasien_id, nik, nama, tgl_lahir, alamat, no_telepon)
VALUES ('A1180000-0000-4000-8000-000000000018', '8888777766665555', N'Pasien Scratch Task 18', '1990-05-15', N'Alamat Scratch', '081234567890');
SELECT pasien_id, nik, nama, is_active FROM dbo.pasien WHERE pasien_id = 'A1180000-0000-4000-8000-000000000018';
SELECT COUNT(*) AS audit_after_insert FROM dbo.audit_logs WHERE entitas_id = 'A1180000-0000-4000-8000-000000000018';
