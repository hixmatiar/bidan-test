# Assignment: plan checkbox 3

Repository: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan (current dir).
Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read first
1. `.omo/plans/praktik-bidan-monorepo.md` — checkbox 3 and the Error catalogue / envelope tables in the Scope section.
2. `TSD.md` lines 100-108 (response envelope and error format).
3. `backend/tsconfig.json` and `backend/package.json` (already exist).

## Implement exactly checkbox 3
Create:
- `backend/src/types/api.ts` — `Role = 'BIDAN' | 'ADMIN'`; `AuthUser { user_id; username; role }`; `PaginationMeta { current_page; per_page; total; last_page }`; `ApiResponse<T>` discriminated union matching the TSD envelope for success and error.
- `backend/src/types/express.d.ts` — augment `Express.Request` with `user?: AuthUser` and `Express.Locals` with `db?: import('mssql').ConnectionPool`.
- `backend/src/utils/errors.ts` — `ERROR_CATALOG` containing EVERY code from the plan's catalogue with numeric http + default Indonesian message; `class AppError extends Error { code; http; errors? }`; `isAppError`.
- `backend/src/utils/response.ts` — `ok<T>(res, data, message, meta?)` and `fail(res, error)` emitting the exact envelopes (status string, message, data/meta or errors).
- `backend/src/utils/pagination.ts` — `parsePagination(body)` clamping `per_page` 1..100 (default 15) and `current_page` >= 1, throwing `AppError('ERR-VAL-03')` for non-numeric/out-of-contract values; `buildMeta(total, page, perPage)`.

Constraints:
- CommonJS, `strict` TypeScript, `@/*` path aliases allowed, no `any`, no TODO/stub.
- Do NOT invent error codes outside the plan catalogue and do NOT omit any.
- Do NOT create routes, app, middlewares, SQL, README, or any other file.
- Do not modify the plan, `.omo/`, or git config.

## Verify (must actually run)
1. `cd backend && npx tsc --noEmit` → exit 0.
2. `cd backend && npx tsc` (emits dist) then a node assertion that every catalogue code exists with a numeric http and `AppError` carries it. Use `node -e` with `require('./dist/utils/errors.js')`.
3. Manual QA: a node snippet (tsx or compiled) proving `ok()` includes `meta` only when passed and `parsePagination({per_page:500}).per_page === 100`, `parsePagination({per_page:0}).per_page === 15`.

## Record and commit
- Append the real command output to `.omo/evidence/task-3-praktik-bidan-monorepo.txt`.
- Commit ONLY the new files: `git add backend/src/types backend/src/utils && git commit -m "feat(backend): add typed envelope and error catalogue"`.
- If a commit fails due to a concurrent git lock, retry up to 3 times.

## Finish
Print `DONE_TASK_3` on its own line, then a DoneClaim JSON with changed_files, tests (command+result), manual_qa artifact, cleanup, risks.