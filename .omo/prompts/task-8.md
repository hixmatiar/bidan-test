# Assignment: plan checkbox 8

Repository: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan (current dir).
Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read first
1. Plan checkbox 8 (full paragraph).
2. `backend/database/01_schema.sql` (the live schema, already executed).
3. `TSD.md` lines 205-206 and 229-231.

## Implement exactly checkbox 8
Create `backend/database/02_functions_views.sql`:
- 4 scalar functions with `CREATE OR ALTER`, schema-qualified: `dbo.fn_hitung_estimasi_jam`, `dbo.fn_status_stok`, `dbo.fn_harga_berlaku`, `dbo.fn_cek_alergi` — signatures and semantics exactly as the plan (NULL handling included).
- 14 views with `CREATE OR ALTER VIEW`: v_antrean_harian, v_tagihan_belum_lunas, v_rekap_pendapatan, v_inventaris_status, v_harga_berlaku, v_rekap_kunjungan_harian, v_tren_layanan, v_jam_tersibuk, v_penjualan_item_periode, v_audit_log_detail, v_sesi_sisa_kuota, v_profil_rme, v_tagihan_detail, v_riwayat_stok_item.
- "Today" uses `SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00')`.
- Only reference tables from 01_schema.sql.

Constraints:
- Do NOT create procedures, triggers, or seed rows.
- Do NOT modify 01_schema.sql, the plan, `.omo/`, or any TS file.
- SQL Server 2025 syntax; idempotent re-run.

## Verify (must actually run)
Host has no sqlcmd. Use the live container:
`P=$(docker inspect sql_server_pikachen --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MSSQL_SA_PASSWORD=//p')`
then `docker exec -i sql_server_pikachen /opt/mssql-tools18/bin/sqlcmd -I -C -S localhost -U sa -P "$P" -d PraktikBidan -b < backend/database/02_functions_views.sql`.
Do NOT print the password.
Checks:
1. first run exit 0; re-run exit 0 (idempotent).
2. `SELECT name FROM sys.objects WHERE type IN ('FN','V') AND name IN (...)` returns all 18 names.
3. `SELECT dbo.fn_harga_berlaku('ITEM', NEWID(), '2020-01-01')` returns NULL without error.
4. `SELECT * FROM dbo.v_sesi_sisa_kuota` executes (0 rows is fine before seed).

## Record and commit
- Append the real command output to `.omo/evidence/task-8-praktik-bidan-monorepo.txt`.
- Commit only the SQL file: `git add backend/database/02_functions_views.sql && git commit -m "feat(db): add scalar functions and 14 reporting views"`. Retry up to 3 times on git lock.

## Finish
Print `DONE_TASK_8` on its own line, then a DoneClaim JSON (changed_files, tests command+result, manual_qa artifact, cleanup, risks).