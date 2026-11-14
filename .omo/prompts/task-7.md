# Assignment: plan checkbox 7

Repository: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan (current dir).
Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read first
1. `.omo/plans/praktik-bidan-monorepo.md` — checkbox 7 (the FULL paragraph; read the whole line, it is long).
2. `TSD.md` lines 174-204 (the 18-table data model).
3. `.omo/drafts/praktik-bidan-monorepo.md` decision 16 (DB_APP_USER block).

## Implement exactly checkbox 7
Create `backend/database/01_schema.sql`:
- Idempotent database creation `IF DB_ID(N'PraktikBidan') IS NULL CREATE DATABASE PraktikBidan; GO USE PraktikBidan;`.
- 18 tables in FK order with all columns, CHECK constraints, defaults, PKs, FKs, and the self-FK described in the plan.
- All filtered/unique/supporting indexes listed in the plan.
- Data-shape CHECKs: `riwayat_harga` exactly one of item_id/layanan_id matching ref_tipe; `tagihan_rincian` exactly one of item_id/layanan_id; `audit_logs` ISJSON checks; `tagihan_rincian.subtotal` persisted computed column; `tagihan.kunjungan_id UNIQUE`; `pasien.nik CHAR(16) UNIQUE`; `otp_reset` and `tagihan_rincian` cascade deletes; `audit_logs.user_id ON DELETE SET NULL` with the soft-delete note.
- End with a commented `DB_APP_USER` creation/grant block plus `DENY UPDATE, DELETE ON dbo.audit_logs TO DB_APP_USER` and a DBA mapping note.
- Use `IF OBJECT_ID(...) IS NULL` guards; never `CREATE OR ALTER` here.

Constraints:
- Do NOT create functions, views, procedures, triggers, or seed data (todos 8-11).
- Do NOT modify any other file, the plan, or `.omo/`.
- Indonesian/English comments are fine; SQL Server 2025 syntax.

## Verify (must actually run)
1. Locate `sqlcmd`: `command -v sqlcmd` or `/opt/homebrew/bin/sqlcmd` or `/opt/mssql-tools18/bin/sqlcmd`.
2. The DB may be the locally installed SQL Server on `localhost,1433` (OrbStack). Try, in order, until one connects:
   - `DB_PASSWORD` from `backend/.env` if the file exists
   - `sqlcmd -C -S localhost,1433 -U sa -P 'Bidan#Dev2026' -Q "SELECT @@VERSION"`
   Do NOT create `backend/.env`.
3. If reachable: run `sqlcmd -C -S localhost,1433 -U sa -P <pwd> -d master -b -i backend/database/01_schema.sql`; then verify `SELECT COUNT(*) FROM sys.tables` for the 18 names = 18, the filtered index exists, and re-run the file to prove idempotency.
4. If NOT reachable (login failed / no sqlcmd): do a static review instead — parse the file, confirm 18 `CREATE TABLE`, the named index, and the constraints — and record the exact connection error verbatim. NEVER claim execution without a captured successful run.

## Record and commit
- Append real command output to `.omo/evidence/task-7-praktik-bidan-monorepo.txt`.
- Commit only the SQL file: `git add backend/database/01_schema.sql && git commit -m "feat(db): add schema for 18 tables with constraints and indexes"`.
- If a commit fails due to a concurrent git lock, retry up to 3 times.

## Finish
Print `DONE_TASK_7` on its own line, then a DoneClaim JSON with changed_files, tests (command+result), manual_qa artifact (or static-review fallback with the exact error), cleanup, risks.