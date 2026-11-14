# Assignment: plan checkbox 6

Repository: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan (current dir).
Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read first
1. Plan checkbox 6 (full paragraph).
2. The plan's ENDPOINT INVENTORY table (all 51 method+path pairs) in the Scope section — extract every row, do not invent or drop any.
3. `backend/src/app.ts`, `backend/src/middlewares/*`, `backend/src/routes/index.ts` (stub created by task 5).
4. `TSD.md` lines 86-170.

## Implement exactly checkbox 6
- Replace `backend/src/routes/index.ts` to mount: `/auth`, `/public`, `/pasien`, `/reservasi`, `/sesi`, `/alergi`, `/kunjungan`, `/tagihan`, `/keuangan`, `/inventaris`, `/harga`, `/laporan`, `/konten`, `/notifikasi`, `/audit-logs` under `/api/v1`.
- Create one router file per module under `backend/src/routes/`. Protected routers: `router.use(authMiddleware, dbSessionContext)`. Public router: `router.use(publicRateLimiter, dbSessionContext)`.
- Create `backend/src/controllers/*.ts` with one-line stubs throwing `AppError('ERR-SYS-01')`; handlers must be `async` and pass errors to `next` (or throw inside an async wrapper the errorHandler can catch — Express 5 is not used, so use explicit try/catch + next).
- Register EXACTLY the 51 method+path pairs from the inventory (method + path + role notes). No health/docs routes, no GET.
- Create `backend/src/scripts/route-audit.ts`:
  - set safe env defaults (`JWT_SECRET`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `WA_API_URL`, `WA_API_TOKEN`) BEFORE requiring `../app` via `require` (not static import; CJS hoisting),
  - recursively walk `app._router.stack` (Express 4) collecting METHOD + full path,
  - print sorted `METHOD /api/v1/...` lines, assert zero GET, print total, exit 1 on any GET or total !== 51.

Constraints:
- CommonJS, strict TS, `@/*` imports, no `any`.
- Do NOT implement business logic, validators, repositories or SQL (later todos). Stubs only.
- Do NOT modify `app.ts`, `server.ts`, middlewares, `jobs/`, plan, or `.omo/`.
- No GET endpoints anywhere.

## Verify (must actually run)
1. `cd backend && npx tsc --noEmit && npm run build` → exit 0.
2. `npm run audit:routes` → prints 51 lines, zero GET, exits 0.
3. `grep -rn "\.get(" backend/src/routes backend/src/controllers` returns nothing.
4. Negative QA: temporarily add `router.get('/__probe', ...)` to ONE router, run `npm run audit:routes`, confirm exit 1, then REMOVE it and confirm exit 0 and clean `git status`.

## Record and commit
- Append real output to `.omo/evidence/task-6-praktik-bidan-monorepo.txt`.
- Commit: `git add backend/src/routes backend/src/controllers backend/src/scripts/route-audit.ts && git commit -m "feat(backend): register 51 non-GET routes with audit script"`. Retry up to 3 times on git lock.

## Finish
Print `DONE_TASK_6` on its own line, then a DoneClaim JSON (changed_files, route count by module, tests command+result, manual_qa artifact, cleanup, risks).