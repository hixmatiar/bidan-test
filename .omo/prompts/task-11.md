# Assignment: plan checkbox 11

Repository: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan (current dir).
Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read first
1. Plan checkbox 11.
2. `backend/database/01_schema.sql` (constraints + CHECKs), `02_functions_views.sql`.
3. `TSD.md` lines 66 and 198; draft seed decision.

## Implement exactly checkbox 11
Create `backend/database/05_seed.sql`:
- Idempotent via `IF NOT EXISTS` per natural key (username, layanan.nama, item nama+satuan, konten tipe+judul, sesi tanggal+jam).
- `EXEC sp_set_session_context @key=N'user_id', @value=NULL; EXEC sp_set_session_context @key=N'ip', @value=N'127.0.0.1';` before writes.
- Users with real bcrypt cost-12 hashes generated during implementation (use `backend/node_modules/bcryptjs` via `node -e`): `bidan` / `Bidan#2026` (BIDAN) and `admin` / `Admin#2026` (ADMIN), distinct hashes, nama_lengkap/no_telepon filled.
- >= 6 layanan (mix KEBIDANAN and UMUM) with active open `riwayat_harga` rows.
- >= 8 item_inventaris (mix OBAT and PRODUK_KESEHATAN), one below stok_minimum and one expiring within 3 months, each with an open ITEM price row.
- Five sesi_praktik dated CURRENT_DATE+1..+5 (Asia/Jakarta, use `CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE)`), kuota 10-20, durasi_per_pasien 15, jam 08:00-12:00.
- konten_publik rows: PROFIL, LAYANAN, KONTAK, GALERI, TESTIMONI (testimonial initials only).
- Do NOT insert reservations/visits/payments/audit rows and never store plaintext passwords.

Constraints:
- Do NOT modify 01-04 SQL, TS files, plan, or `.omo/`.
- No plaintext password anywhere in the file, including comments.

## Verify (must actually run)
Host has no sqlcmd: `P=$(docker inspect sql_server_pikachen --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MSSQL_SA_PASSWORD=//p')`
`docker exec -i sql_server_pikachen /opt/mssql-tools18/bin/sqlcmd -I -C -S localhost -U sa -P "$P" -d PraktikBidan -b < backend/database/05_seed.sql`. Do NOT print the password.
1. Run twice; both exit 0 and counts stay stable (2 users, 6+ layanan, 8+ items, 5 sesi, 5 konten).
2. Verify with `node -e "const b=require('./backend/node_modules/bcryptjs'); ..."` using the stored hashes fetched via sqlcmd `-h -1 -W` that `bcrypt.compare('Bidan#2026', hash)` and `Admin#2026` are true (fetch hashes into a temp file, do not print plaintext).
3. Confirm every layanan and item has an open price (`berlaku_sampai IS NULL`).
4. Confirm the audit triggers produced CREATE rows for seeded tables and that users audit JSON contains no `password_hash`.

## Record and commit
- Append real output to `.omo/evidence/task-11-praktik-bidan-monorepo.txt`.
- Commit only the SQL file: `git add backend/database/05_seed.sql && git commit -m "feat(db): seed users, services, inventory, prices, sessions and content"`. Retry up to 3 times on git lock.

## Finish
Print `DONE_TASK_11` on its own line, then a DoneClaim JSON (changed_files, tests command+result, manual_qa artifact, cleanup, risks).