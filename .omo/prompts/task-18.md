# Assignment: plan checkbox 18

Repo: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan. Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read
Plan checkbox 18; endpoints 20-24 rows; `backend/src/{modules,routes/pasien.routes.ts,routes/alergi.routes.ts,middlewares}`; `TSD.md:54,134-139,224-225`; draft decisions 10 and 12; `01_schema.sql`.

## Implement exactly checkbox 18
Create `backend/src/modules/rme/` (validators, repository, service, controller) and wire the existing routes:
- `POST /pasien/list` (BIDAN) — add `has_red_flag` from active alergi_kondisi (ALERGI_OBAT or KEHAMILAN_RISTI) + last visit date; pagination; ADMIN 403.
- `POST /pasien/:id/rme/detail` (BIDAN) — profile, active allergies, red-flag status, visits with resep items newest first; BEFORE responding insert `audit_logs` `aksi='VIEW_RME'`, `entitas='pasien'`, `entitas_id=:id`, user/ip from request, `nilai_baru=NULL`. Unknown patient 404 ERR-RME-01.
- `POST /pasien/:id/alergi` (BIDAN) — `{kategori, nama, item_id?, keterangan?}`; ALERGI_OBAT requires item_id; other categories reject item_id (422 ERR-VAL-01).
- `PATCH /alergi/:id` (BIDAN) — `{is_active?, keterangan?}`; unknown 404 (use ERR-VAL-01/ERR-RME-01 as appropriate, document choice).
- `POST /pasien/:id/red-flag/konfirmasi` (BIDAN) — insert `audit_logs` `aksi='RED_FLAG_CONFIRMED'` with `nilai_baru` = JSON snapshot of active flags, return `{confirmed:true, confirmed_at}`. No new table.
ADMIN gets 403 on every route here. Parameterized SQL.

Constraints: no visit creation, no PDF, no other modules, no plan/.omo edits. CommonJS, strict TS.

## Verify
1. `npx tsc --noEmit && npm run build && npm run audit:routes`.
2. Live port 4118: bidan token; create a scratch patient (direct SQL insert inside a transaction or via public? use SQL scratch with unique NIK), then:
   - RME detail adds exactly one VIEW_RME audit row; response has no NIK leak to admin (admin gets 403);
   - add ALERGI_OBAT with item → `dbo.fn_cek_alergi` returns 1; without item_id → 422;
   - confirm red flag → audit row with valid JSON today;
   - unknown pasien → 404.
   Roll back all scratch data; verify audit rows count for the scratch patient after rollback is 0.
3. Admin token on each route → 403 ERR-AUTH-03.

## Record/commit
Append to `.omo/evidence/task-18-praktik-bidan-monorepo.txt`; commit `feat(backend): add RME reading, allergy and red-flag endpoints`. Print `DONE_TASK_18` + DoneClaim.