# Assignment: plan checkbox 5

Repository: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan (current dir).
Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read first
1. Plan checkbox 5 (full paragraph) and the middleware description.
2. `backend/src/utils/{errors,response,db,jwt}.ts`, `backend/src/config/env.ts`, `backend/src/types/*`.
3. `TSD.md` lines 86-108 and 224-227.

## Implement exactly checkbox 5
Create under `backend/src`:
- `middlewares/auth.ts` — `authMiddleware` (Bearer; 401 ERR-AUTH-02 missing/invalid, ERR-AUTH-04 expired via verifyToken) and `checkRole(...roles)` (403 ERR-AUTH-03).
- `middlewares/dbSession.ts` — `dbSessionContext`: `await acquire()` (per-request pool), run `EXEC sp_set_session_context @key=N'user_id', @value=@uid;` and `@key=N'ip'` with NVarChar params, store in `res.locals.db`, release exactly once on `finish`/`close` (guard against double release). `uid` = `req.user?.user_id ?? null`, ip = `req.ip`.
- `middlewares/validate.ts` — `validate({body?, params?})` mapping Zod failures to 422 ERR-VAL-01/ERR-VAL-02 with `errors: [{path, message}]`.
- `middlewares/rateLimit.ts` — express-rate-limit v7 `{ windowMs: 60000, limit: env.RATE_LIMIT_PUBLIC, standardHeaders: 'draft-7', legacyHeaders: false }`, handler responds with `fail(res, new AppError('ERR-SYS-03', undefined, undefined, 429))`.
- `middlewares/errorHandler.ts` — `errorHandler` maps AppError, ZodError, body SyntaxError (ERR-VAL-04 400), mssql errors whose message starts with `ERR-` (code = message.split('|')[0], HTTP from ERROR_CATALOG if known), RequestError/ConnectionError → ERR-SYS-02, else ERR-SYS-01; no stack in production. Also export `notFound` (404 ERR-SYS-01).
- `app.ts` — helmet, cors with `env.CORS_ORIGINS` allowlist (no wildcard), `express.json({ limit: '1mb' })`, `app.set('trust proxy', 1)`, mount `/api/v1` router, notFound, errorHandler.
- `server.ts` — listen on env.PORT, call `startJobs()`, SIGTERM/SIGINT graceful: close pool via db util, then exit.
- `jobs/index.ts` — minimal stub `export async function startJobs(): Promise<void> {}` with a comment that task 34 replaces it.
- `routes/index.ts` — minimal `Router()` with a comment that task 6 registers the 51 routes; do NOT add any route yet.

Constraints:
- CommonJS, strict TS, `@/*` imports, no `any`, no stubs other than the two explicitly allowed above.
- Do NOT register the 51 endpoints (task 6), controllers, SQL, or tests dirs.
- Do NOT modify existing files except adding the new ones; do not touch plan/.omo/git config.

## Verify (must actually run)
1. `cd backend && npx tsc --noEmit && npm run build` → exit 0.
2. Start the server with dummy DB env: `PORT=4100 DB_HOST=127.0.0.1 DB_PORT=1433 DB_NAME=x DB_USER=x DB_PASSWORD=x JWT_SECRET=test WA_API_URL=http://127.0.0.1:1 WA_API_TOKEN=x node dist/server.js` in background; confirm it logs the port, then stop it. It must NOT connect to the DB at boot (lazy pool).
3. `curl -s -i -X POST localhost:4100/api/v1/nope -H 'content-type: application/json' -d '{'` → 400 `ERR-VAL-04` (or 404 with the notFound error handler if body parsing precedes; capture actual and explain).
4. `grep -rn "app.get(" backend/src` returns nothing.
5. `curl` an unknown path → JSON envelope with `status:'error'`, no stack.

## Record and commit
- Append real output to `.omo/evidence/task-5-praktik-bidan-monorepo.txt`.
- Commit only your new files: `git add backend/src/app.ts backend/src/server.ts backend/src/middlewares backend/src/jobs backend/src/routes && git commit -m "feat(backend): add express app, middlewares and server bootstrap"`. Retry up to 3 times on git lock.

## Finish
Print `DONE_TASK_5` on its own line, then a DoneClaim JSON (changed_files, tests command+result, manual_qa artifact, cleanup, risks).