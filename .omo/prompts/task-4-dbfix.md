# Fix: backend/src/utils/db.ts acquire/release semantics

The file currently returns the SHARED pool from `acquire()` and does nothing in `release()`. That cannot pin a per-request session context (task 5 requires `sp_set_session_context` on one connection).

Edit ONLY `backend/src/utils/db.ts`:
- Keep `getPool()` and `withTransaction(fn)` as they are.
- Change `acquire()` to create a DEDICATED pool for one request:
  ```ts
  const requestConfig: sql.config = { ...poolConfig, pool: { max: 1, min: 0, idleTimeoutMillis: 30000 } };
  export async function acquire(): Promise<sql.ConnectionPool> {
    const scoped = new sql.ConnectionPool(requestConfig);
    await scoped.connect();
    return scoped;
  }
  export async function release(conn: sql.ConnectionPool): Promise<void> {
    await conn.close();
  }
  ```
  Adjust types/formatting to the existing style; keep the exported names identical.
- Remove the now-wrong `ponytail:` comment about multiplexing.

Constraints:
- No other file, no new dependencies, no tests directory, no plan/.omo edits.
- `release` must be idempotent-safe for a pool that was already closed: wrap `close()` in try/catch and ignore errors.

Verify: `cd backend && npx tsc --noEmit` exit 0. Then run a tiny tsx check with fake DB env that `acquire()` rejects on connection failure (no server needed): set DB_HOST=127.0.0.1 DB_PORT=1, expect a rejection containing ECONNREFUSED, and confirm no hang > 12s. Record output in `.omo/evidence/task-4-praktik-bidan-monorepo.txt` (append).

Commit: `git add backend/src/utils/db.ts && git commit -m "fix(backend): scope db connections per request for session context"`. Print `DONE_DB_FIX`, then a short DoneClaim.