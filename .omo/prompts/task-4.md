# Assignment: plan checkbox 4

Repository: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan (current dir).
Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read first
1. Plan checkbox 4 (full paragraph) plus the env key list in the Scope section.
2. `backend/.env.example` (22 keys — the contract).
3. `TSD.md` lines 78-80 and 112-123.

## Implement exactly checkbox 4
Create under `backend/src`:
- `config/env.ts` — Zod-validated `process.env`; required DB_* + `JWT_SECRET`; numeric coercions (`DB_PORT`, `DB_POOL_MAX` default 10, `JWT_EXPIRES_IN` default 1800, `OTP_TTL`, `RATE_LIMIT_PUBLIC`); `CORS_ORIGINS` comma-split to string[]; WA_* keys; fail-fast naming the missing key. Export a typed `env`.
- `utils/db.ts` — lazy singleton `sql.ConnectionPool` (encrypt/trustServerCertificate/pool.max from env), `getPool()`, `acquire()`, `release(conn)`, `withTransaction(fn)`.
- `utils/jwt.ts` — HS256 sign `{sub, username, role}` with seconds expiry; verify that distinguishes expired (`ERR-AUTH-04`) from invalid (`ERR-AUTH-02`) using the existing AppError catalogue.
- `utils/password.ts` — bcrypt cost 12 hash/compare.
- `utils/otp.ts` — 6 digits via `crypto.randomInt`, bcrypt cost 10 hash, constant-time compare.
- `utils/wa.ts` — POST `{target, message}` to `WA_API_URL` with Bearer `WA_API_TOKEN`, 10s timeout, typed error on non-2xx/timeout.

Constraints:
- Do NOT set session context here.
- Do NOT create routes, app, middlewares, SQL, tests directories, or README.
- Do NOT modify `backend/.env.example`, plan, or `.omo/`. Do NOT create `backend/.env`.
- CommonJS, strict TS, `@/*` imports, no `any`, no stubs.

## Verify (must actually run)
1. `cd backend && npx tsc --noEmit` → exit 0.
2. Missing env fail-fast: run `cd backend && env -i PATH="$PATH" npx tsx -e "import('./src/config/env')"` (no DB vars) and confirm non-zero exit naming `DB_HOST`.
3. JWT round-trip: `cd backend && DB_HOST=x DB_PORT=1433 DB_NAME=x DB_USER=x DB_PASSWORD=x JWT_SECRET=test npx tsx -e "<sign then verify with 1s expiry, sleep 2s, expect ERR-AUTH-04>"`; print both results.
4. WA failure: with `WA_API_URL=http://127.0.0.1:1` the call rejects within 11s (measure with `time`).

## Record and commit
- Append real output to `.omo/evidence/task-4-praktik-bidan-monorepo.txt`.
- Commit only your files: `git add backend/src/config backend/src/utils/env* backend/src/utils/db.ts backend/src/utils/jwt.ts backend/src/utils/password.ts backend/src/utils/otp.ts backend/src/utils/wa.ts && git commit -m "feat(backend): add env, db, jwt, password and wa infrastructure"`. If `git add` pathspec fails because a file name differs, add the actual new files only.
- Retry the commit up to 3 times on git lock errors.

## Finish
Print `DONE_TASK_4` on its own line, then a DoneClaim JSON (changed_files, tests command+result, manual_qa artifact, cleanup, risks).