# Assignment: plan checkbox 13

Repo: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan. Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read
Plan checkbox 13; endpoint inventory rows for endpoints 6-8; existing `backend/src/{modules,routes,controllers,middlewares,utils}`; `TSD.md:118-121,52`.

## Implement exactly checkbox 13
Create `backend/src/modules/public/` (validators, repository, service, controller). Replace the three stubs in `backend/src/routes/public.routes.ts` (keep `router.use(publicRateLimiter, dbSessionContext)`).
- `POST /public/konten/list` — filter optional `tipe`; only `is_published = 1`, ordered by `urutan`; pagination via `parsePagination`/`buildMeta`; public field whitelist (no admin fields).
- `POST /public/layanan/list` — optional `kategori`; only `is_active = 1`; pagination.
- `POST /public/sesi/list` — optional `tanggal_dari`/`tanggal_sampai`; read `v_sesi_sisa_kuota` where `is_active = 1 AND tanggal >= today (Asia/Jakarta)` ordered by tanggal/jam_mulai; pagination.
Every list returns `meta`. Do not reuse admin handlers. Parameterized SQL only.

Constraints: no other modules/endpoints, no app.ts/middleware changes, no plan/.omo edits. CommonJS, strict TS, `@/*`.

## Verify
1. `cd backend && npx tsc --noEmit && npm run build && npm run audit:routes` (51/0 GET).
2. Live: `P=$(docker inspect sql_server_pikachen --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MSSQL_SA_PASSWORD=//p')`; start `PORT=4113 DB_HOST=127.0.0.1 DB_PORT=1433 DB_NAME=PraktikBidan DB_USER=sa DB_PASSWORD="$P" JWT_SECRET=test WA_API_URL=http://127.0.0.1:1 WA_API_TOKEN=x node backend/dist/server.js` (from backend dir), then curl:
   - each endpoint returns `status:'success'` + `meta.current_page = 1`;
   - `per_page: 500` clamps to 100; `per_page:"abc"` → 422 ERR-VAL-03;
   - konten `tipe=TESTIMONI` only testimonials; unpublished rows never appear (temporarily flip one row in a transaction, verify, rollback).
   Stop the server; no scratch files.

## Record/commit
Append output to `.omo/evidence/task-13-praktik-bidan-monorepo.txt`; `git add backend/src/modules/public backend/src/routes/public.routes.ts backend/src/controllers/public.controller.ts` (if controller changed) and commit `feat(backend): add public content, service and session endpoints` (retry on git lock). Print `DONE_TASK_13` + DoneClaim.