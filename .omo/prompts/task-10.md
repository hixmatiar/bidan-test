# Assignment: plan checkbox 10

Repository: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan (current dir).
Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read first
1. Plan checkbox 10 (full paragraph).
2. `backend/database/01_schema.sql` (live schema).
3. `TSD.md` line 214; `.omo/drafts/praktik-bidan-monorepo.md` decisions 7 and 10.

## Implement exactly checkbox 10
Create `backend/database/04_triggers.sql`:
- Exactly 15 `CREATE OR ALTER TRIGGER trg_audit_<table> ON dbo.<table> AFTER INSERT, UPDATE, DELETE` for: users, pasien, sesi_praktik, layanan, reservasi, kunjungan, resep_item, alergi_kondisi, item_inventaris, riwayat_stok, riwayat_harga, tagihan, tagihan_rincian, pembayaran, konten_publik.
- Set-based (no cursors): one audit row per affected PK via `FOR JSON PATH, WITHOUT_ARRAY_WRAPPER`; `aksi` CREATE/UPDATE/DELETE; `user_id = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER)`; `user_ref` from users lookup; `ip_address = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45))`; `entitas` table name; `entitas_id` PK as NVARCHAR(64); `nilai_lama`/`nilai_baru` JSON.
- `trg_audit_users` JSON MUST use the explicit column list excluding `password_hash`: user_id, username, nama_lengkap, role, no_telepon, is_active, last_login_at, created_at.
- Add `trg_audit_logs_immutable` INSTEAD OF UPDATE, DELETE on audit_logs raising `RAISERROR('audit_logs bersifat append-only', 16, 1); ROLLBACK TRANSACTION;`.
- Comment that otp_reset, log_notifikasi, audit_logs are intentionally excluded from audit triggers.

Constraints:
- Do NOT create functions, views, procedures, seed rows, or TS files.
- Do NOT modify 01_schema.sql, the plan, or `.omo/`.
- SQL Server 2025 syntax; `CREATE OR ALTER` for triggers; idempotent.

## Verify (must actually run)
Host has no sqlcmd. Use the live container:
`P=$(docker inspect sql_server_pikachen --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MSSQL_SA_PASSWORD=//p')`
`docker exec -i sql_server_pikachen /opt/mssql-tools18/bin/sqlcmd -I -C -S localhost -U sa -P "$P" -d PraktikBidan -b < backend/database/04_triggers.sql`.
Do NOT print the password.
Checks:
1. Run twice, both exit 0.
2. `SELECT COUNT(*) FROM sys.triggers WHERE name LIKE 'trg_audit[_]%'` = 15 (plus the immutable trigger separately).
3. Real QA in ONE sqlcmd batch inside a transaction you roll back: insert a temp users row (or update an existing one if seed absent — use a scratch insert), with `EXEC sp_set_session_context @key=N'user_id', @value=<uuid>; EXEC sp_set_session_context @key=N'ip', @value=N'127.0.0.1';`, then confirm exactly one audit row with aksi='UPDATE' or 'INSERT' and valid JSON (`ISJSON(nilai_baru)=1`), and that `password_hash` is absent from `nilai_baru`.
4. `UPDATE audit_logs SET aksi='x'` raises the append-only message and changes nothing; `DELETE FROM audit_logs` same (wrap in TRY/CATCH so the batch reports the error).
Roll back all QA changes.

## Record and commit
- Append real command output to `.omo/evidence/task-10-praktik-bidan-monorepo.txt`.
- Commit only the SQL file: `git add backend/database/04_triggers.sql && git commit -m "feat(db): add 15 audit triggers and immutable audit guard"`. Retry up to 3 times on git lock.

## Finish
Print `DONE_TASK_10` on its own line, then a DoneClaim JSON (changed_files, tests command+result, manual_qa artifact, cleanup, risks).