# Assignment: plan checkbox 12

Repository: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan (current dir).
Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read first
1. Plan checkbox 12 (endpoints 1-5, lockout, OTP) and the endpoint inventory rows for auth.
2. `backend/src/{app.ts,middlewares/*,utils/*,config/env.ts,routes/index.ts,routes/auth.routes.ts}` (route stub exists after task 6).
3. `TSD.md` lines 51, 113-117, 220-227; seed file `backend/database/05_seed.sql`.

## Implement exactly checkbox 12
Under `backend/src/modules/auth/`:
- `auth.validators.ts` — Zod: login username 3..50 + password min 8; reset request username; reset verify username + 6-digit kode + new password min 8.
- `auth.repository.ts` — find by username; increment failures + lock; reset counters; update password; OTP insert/find latest unused unexpired/consume. Use `res.locals.db` (per-request pool) via a helper that takes `ConnectionPool`.
- `auth.service.ts` — locked_until > now → LOCK-01; wrong password increments failed_attempts, 5th sets locked_until = now + env.LOCKOUT_DURATION and returns LOCK-01, earlier → AUTH-01; inactive → AUTH-05; success resets counters + last_login_at + returns 30-minute token; logout stateless; refresh re-issues from req.user; reset request invalidates prior unused codes, stores bcrypt(OTP) with expired_at = now + OTP_TTL, sends WA, writes log_notifikasi jenis OTP TERKIRIM/GAGAL WITHOUT failing the request; reset verify checks latest unused unexpired hash, updates password, clears lock.
- `auth.controller.ts` + `routes/auth.routes.ts` — `router.use(publicRateLimiter)` and `router.use(dbSessionContext)` for the WHOLE router; `/login`, `/reset/request`, `/reset/verify` public; `/logout`, `/refresh` behind authMiddleware. Token in JSON only, no cookies. Reset request returns the same message whether the username exists or not.

Constraints:
- CommonJS, strict TS, `@/*` imports, no `any`, no stubs. Use the existing envelope helpers and ERROR_CATALOG.
- Do NOT implement other modules, jobs, SQL files, or tests dirs. Do NOT modify app.ts, middlewares, utils, plan, `.omo/`, or other routers.
- Do NOT create `backend/.env`; pass env vars inline for QA.

## Verify (must actually run)
1. `cd backend && npx tsc --noEmit && npm run build` → exit 0.
2. Live QA against the real DB (SQL Server in container `sql_server_pikachen`): obtain `DB_PASSWORD` via `docker inspect ... MSSQL_SA_PASSWORD` (never print it), then start the built app on port 4101 with DB_HOST=127.0.0.1 DB_PORT=1433 DB_NAME=PraktikBidan DB_USER=sa JWT_SECRET=test WA_API_URL=http://127.0.0.1:1 WA_API_TOKEN=x and run:
   - login bidan/Bidan#2026 → 200 + `data.token` (save token to /tmp);
   - refresh with the token → 200 new token; logout → 200;
   - wrong password → 401 ERR-AUTH-01;
   - 5 consecutive wrong passwords then a 6th with the CORRECT password → 423 ERR-LOCK-01 (then clear the lock and failed_attempts in the DB so seed state is restored);
   - missing token on /logout → 401 ERR-AUTH-02.
   - reset/request for an existing and a non-existing username → identical status/message; confirm one `log_notifikasi` OTP row with status GAGAL (WA down) was written for the existing one.
3. Stop the server; confirm `git status` has no scratch files.

## Record and commit
- Append real output to `.omo/evidence/task-12-praktik-bidan-monorepo.txt`.
- Commit: `git add backend/src/modules/auth backend/src/routes/auth.routes.ts && git commit -m "feat(backend): implement authentication and OTP reset"`. Retry up to 3 times on git lock.

## Finish
Print `DONE_TASK_12` on its own line, then a DoneClaim JSON (changed_files, tests command+result, manual_qa artifact, cleanup, risks).