# Assignment: plan checkbox 17

Repo: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan. Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read
Plan checkbox 17; existing `backend/src/{modules,routes/sesi.routes.ts,middlewares,utils}`; `TSD.md:130-133`; `01_schema.sql` sesi_praktik constraints.

## Implement exactly checkbox 17
Create `backend/src/modules/sesi/` (validators, repository, service, controller); replace the 3 stubs in `backend/src/routes/sesi.routes.ts` (ADMIN only via `authMiddleware, checkRole('ADMIN'), dbSessionContext` already mounted).
- `POST /sesi/list` — filters date range/is_active + pagination, ordered tanggal/jam_mulai.
- `POST /sesi` — body `{tanggal, jam_mulai, jam_selesai, kuota_maks, durasi_per_pasien?}`; Zod: jam_selesai > jam_mulai, kuota 1..200, durasi 5..60 default 15; reject overlap on same date (409 ERR-RSV-02).
- `PATCH /sesi/:id` — partial; reject `kuota_maks` below current active reservation count (409 ERR-RSV-01); `is_active=false` does not cancel bookings; unknown id 404 ERR-RSV-03 (use catalogue code).
No delete. Parameterized queries; audit trigger handles logging.

Constraints: no other modules, no schema changes, no plan/.omo edits. CommonJS, strict TS.

## Verify
1. `npx tsc --noEmit && npm run build && npm run audit:routes` (51/0).
2. Live on port 4117: login admin (Admin#2026) to get token; create 09:00-12:00 kuota 10 durasi 15 on a far-future date (+30 days) → 201; list shows it; overlapping 11:00-13:00 same date → 409 ERR-RSV-02; `jam_selesai < jam_mulai` → 422 ERR-VAL-01; then delete the scratch session row (inside a transaction or direct DELETE) so seed state is clean.
3. Confirm an audit row for the created session exists.
Stop server; clean tree.

## Record/commit
Append to `.omo/evidence/task-17-praktik-bidan-monorepo.txt`; commit `feat(backend): add session management endpoints`. Print `DONE_TASK_17` + DoneClaim.