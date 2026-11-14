# praktik-bidan-monorepo - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** Satu aplikasi web lengkap untuk praktik bidan: 18 tabel database, 4 fungsi, 14 laporan siap pakai, 6 proses transaksi otomatis, jejak audit yang tidak bisa diubah, dan 51 layanan API yang semuanya bisa dipanggil (tanpa satu pun metode baca lama). Ditambah koleksi Postman siap impor, panduan menjalankan, dan tampilan awal frontend yang sudah rapi dengan komponen UI.

**Why this approach:** Aturan transaksi yang rawan bentrok (nomor antrean, stok, tagihan, pembayaran) ditaruh di dalam database agar tidak bisa salah hitung saat dua orang mengakses bersamaan; backend hanya memanggil dan menerjemahkan hasilnya. Database uji memakai SQL Server 2025 yang sudah terpasang di laptop, jadi semua alur benar-benar dicoba sebelum dipakai pasien.

**What it will NOT do:** Tidak membuat halaman bisnis frontend (baru kerangka dan komponen dasar), tidak memakai metode GET untuk membaca data, dan tidak menyiapkan container untuk database (produksi tetap memakai SQL Server terpasang, backend PM2/IIS, frontend Vercel).

**Effort:** XL
**Risk:** Medium - permukaan kerjanya besar (51 endpoint, 5 skrip database) dan pengujian database bergantung pada instance SQL Server lokal (port, kredensial, dan mixed-mode auth harus sesuai).

**Decisions to sanity-check:** konfirmasi peringatan Red-Flag disimpan sebagai jejak audit (bukan tabel baru); pembaruan token hanya bisa dari token yang masih berlaku; kredensial awal `bidan`/`admin`; bila instance database lokal tidak bisa dihubungi, pengujian SQL jatuh ke pemeriksaan statis dan itu dicatat apa adanya.

Your next move: start work, or run a high-accuracy review first. Full execution detail follows below.

---

> TL;DR (machine): XL effort, medium risk; full TypeScript monorepo - layered Express API (51 non-GET endpoints), 5 SQL Server scripts (18 tables/4 functions/14 views/6 procedures/16 triggers), local SQL Server 2025 dev target, Postman v2.1, Vite+React+TS+Tailwind+shadcn init only.

## Scope

### Must have

**Authoritative file inventory**

- Root: `README.md`, `.gitignore`.
- `backend/`: `package.json`, `tsconfig.json`, `.env.example`, `src/app.ts`, `src/server.ts`, `src/config/env.ts`, `src/types/api.ts`, `src/types/express.d.ts`, `src/utils/{errors,response,db,jwt,password,otp,wa,pdf,excel,pagination}.ts`, `src/middlewares/{auth,dbSessionContext,validate,rateLimit,errorHandler,notFound}.ts`, `src/validators/*.ts`, `src/routes/*.ts`, `src/controllers/*.ts`, `src/services/*.ts`, `src/repositories/*.ts`, `src/jobs/{reminderH1.job,inventoryWeekly.job,index}.ts`, `src/scripts/route-audit.ts`, `database/01_schema.sql` through `05_seed.sql`, `docs/postman/generate-postman.mjs`, `docs/postman/Praktik_Mandiri_Bidan_API.postman_collection.json`, `docs/postman/Local_Dev.postman_environment.json`.
- `frontend/`: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `postcss.config.js`, `tailwind.config.js`, `components.json`, `.env.example`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`, `src/lib/utils.ts`, `src/components/ui/{button,card,input,label,badge}.tsx`.

**Authoritative endpoint inventory (51, no GET)**

| # | Method + path (prefix `/api/v1`) | Roles | Kind |
| --- | --- | --- | --- |
| 1 | POST `/auth/login` | public | action |
| 2 | POST `/auth/logout` | BIDAN, ADMIN | action |
| 3 | POST `/auth/refresh` | BIDAN, ADMIN | action |
| 4 | POST `/auth/reset/request` | public | action |
| 5 | POST `/auth/reset/verify` | public | action |
| 6 | POST `/public/konten/list` | public | collection |
| 7 | POST `/public/layanan/list` | public | collection |
| 8 | POST `/public/sesi/list` | public | collection |
| 9 | POST `/public/pasien/cek` | public | lookup |
| 10 | POST `/public/reservasi` | public | create |
| 11 | POST `/pasien/identitas/list` | ADMIN, BIDAN | collection |
| 12 | POST `/pasien/walk-in` | ADMIN | create |
| 13 | POST `/reservasi/list` | ADMIN, BIDAN | collection |
| 14 | PATCH `/reservasi/:id/jadwal` | ADMIN | update |
| 15 | PATCH `/reservasi/:id/batal` | ADMIN | update |
| 16 | POST `/sesi/list` | ADMIN | collection |
| 17 | POST `/sesi` | ADMIN | create |
| 18 | PATCH `/sesi/:id` | ADMIN | update |
| 19 | PATCH `/reservasi/:id/status` | BIDAN | update |
| 20 | POST `/pasien/list` | BIDAN | collection |
| 21 | POST `/pasien/:id/rme/detail` | BIDAN | detail |
| 22 | POST `/pasien/:id/alergi` | BIDAN | create |
| 23 | PATCH `/alergi/:id` | BIDAN | update |
| 24 | POST `/pasien/:id/red-flag/konfirmasi` | BIDAN | create |
| 25 | POST `/pasien/:id/kunjungan` | BIDAN | create (SP+TVP) |
| 26 | PATCH `/kunjungan/:id/catatan` | BIDAN | append |
| 27 | POST `/pasien/:id/rme/export` | BIDAN | stream PDF |
| 28 | POST `/kunjungan/:id/tagihan/detail` | ADMIN | detail |
| 29 | POST `/tagihan/:id/pembayaran` | ADMIN | create (SP) |
| 30 | POST `/tagihan/list` | ADMIN | collection |
| 31 | POST `/keuangan/rekap/list` | ADMIN, BIDAN | collection |
| 32 | POST `/inventaris/list` | ADMIN, BIDAN | collection |
| 33 | POST `/inventaris` | ADMIN | create |
| 34 | PATCH `/inventaris/:id` | ADMIN | update |
| 35 | POST `/inventaris/:id/restock` | ADMIN | create (SP) |
| 36 | POST `/inventaris/:id/riwayat/list` | ADMIN, BIDAN | collection |
| 37 | POST `/harga/list` | ADMIN, BIDAN | collection |
| 38 | PUT `/harga/:ref_tipe/:ref_id` | ADMIN | replace (SP) |
| 39 | POST `/harga/:ref_tipe/:ref_id/riwayat/list` | ADMIN, BIDAN | collection |
| 40 | POST `/laporan/ringkasan/list` | BIDAN | collection |
| 41 | POST `/laporan/tren-layanan/list` | BIDAN | collection |
| 42 | POST `/laporan/jam-tersibuk/list` | BIDAN | collection |
| 43 | POST `/laporan/perbandingan/list` | BIDAN | collection |
| 44 | POST `/laporan/export` | BIDAN | stream PDF/XLSX |
| 45 | POST `/konten/list` | ADMIN | collection |
| 46 | POST `/konten` | ADMIN | create |
| 47 | PATCH `/konten/:id` | ADMIN | update |
| 48 | DELETE `/konten/:id` | ADMIN | soft delete |
| 49 | POST `/notifikasi/log/list` | ADMIN | collection |
| 50 | POST `/notifikasi/:id/kirim-ulang` | ADMIN | action |
| 51 | POST `/audit-logs/list` | BIDAN | collection |

**Error catalogue (exact HTTP mapping)**

| Code | HTTP | Meaning |
| --- | --- | --- |
| ERR-AUTH-01 | 401 | Username/password salah |
| ERR-AUTH-02 | 401 | Token tidak ada/tidak valid |
| ERR-AUTH-03 | 403 | Peran tidak diizinkan |
| ERR-AUTH-04 | 401 | Token kedaluwarsa |
| ERR-AUTH-05 | 403 | Akun dinonaktifkan |
| ERR-LOCK-01 | 423 | Akun terkunci 15 menit |
| ERR-RSV-01 | 409 | Kuota sesi penuh |
| ERR-RSV-02 | 409 | Jadwal bentrok / reservasi ganda |
| ERR-RSV-03 | 404 | Reservasi tidak ditemukan |
| ERR-RSV-04 | 409 | Transisi status tidak valid |
| ERR-RSV-05 | 422 | Di luar jam sesi / tanggal lampau |
| ERR-RME-01 | 404 | Pasien tidak ditemukan |
| ERR-RME-02 | 404 | Kunjungan tidak ditemukan |
| ERR-RME-03 | 409 | Konfirmasi Red-Flag belum dilakukan |
| ERR-RME-04 | 422 | Item resep tidak valid / konflik alergi |
| ERR-INV-01 | 404 | Item inventaris tidak ditemukan |
| ERR-INV-02 | 409 | Stok tidak cukup |
| ERR-INV-03 | 422 | Jumlah/satuan tidak valid |
| ERR-FIN-01 | 404 | Tagihan tidak ditemukan |
| ERR-FIN-02 | 409 | Pembayaran melebihi sisa tagihan |
| ERR-PRC-01 | 422 | Harga/periode tidak valid |
| ERR-CNT-01 | 404 | Konten tidak ditemukan |
| ERR-NTF-01 | 502 | WhatsApp gagal / retry habis |
| ERR-RPT-01 | 422 | Parameter laporan tidak valid |
| ERR-VAL-01 | 422 | Validasi body gagal |
| ERR-VAL-02 | 422 | Validasi params gagal |
| ERR-VAL-03 | 422 | Validasi filter/paginasi gagal |
| ERR-VAL-04 | 400 | JSON malformed |
| ERR-SYS-01 | 500 | Kesalahan internal |
| ERR-SYS-02 | 500 | Kesalahan database |
| ERR-SYS-03 | 503 / 429 | Dependensi eksternal tidak tersedia / rate limit |

### Must NOT have (guardrails, anti-slop, scope boundaries)

- No `app.get`, no GET route registration, no custom HEAD/OPTIONS route.
- No ORM/query builder; parameterized `mssql` only.
- No backend/frontend Dockerfile, no `docker-compose.yml`, no production container config, no nginx/IIS config.
- No Swagger/OpenAPI; no Postman content beyond the 51 requests.
- No extra tables/columns/endpoints; no refresh-token table; no unlock-account endpoint.
- No frontend business pages, router usage, API calls, or charts (deps installed, unused).
- No test framework (Jest/Vitest/Supertest); only the scripted smoke checks below.
- No CI, ESLint, Prettier, Husky.
- No `SELECT *` in application SQL (audit trigger JSON snapshots are the exception).

## Verification strategy

> Zero human intervention - all verification is agent-executed.

- Test decision: **none (no framework) + scripted smoke checks**. Backend: `tsc --noEmit`, `npm run build`, `npm run audit:routes`, boot + curl. Frontend: `tsc --noEmit`, `npm run build`. SQL: executed against the already-installed local SQL Server 2025 instance when reachable; otherwise static review with the exact connection failure captured as evidence.
- Evidence: `.omo/evidence/task-<N>-praktik-bidan-monorepo.<ext>` (no ulw-loop active).
- SQL run: `sqlcmd -C -S "$DB_HOST,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -d master -i backend/database/<file>` using the values in `backend/.env`; if `sqlcmd` is not on PATH, use `/opt/mssql-tools18/bin/sqlcmd` (macOS: `/opt/homebrew/bin/sqlcmd` or SSMS/Azure Data Studio equivalent) and record which binary ran.
- API smoke without DB: `PORT=4100 npm run dev`, then `curl -s -X POST localhost:4100/api/v1/public/layanan/list -H 'content-type: application/json' -d '{"page":1,"per_page":15}'` must return `ERR-SYS-02` with HTTP 500 - proves routing, body parsing, validation order, error handler.
- API smoke with DB: login as seeded bidan, use the token, public lists include `meta`, create reservation returns `nomor_antrean`, walk-in works, visit with resep decrements stock, payment marks `LUNAS`.

## Execution strategy

### Parallel execution waves

- Wave A (foundation): 1-6.
- Wave B (SQL): 7-11.
- Wave C (auth/public): 12-14.
- Wave D (clinic): 15-20.
- Wave E (finance/inventory): 21-26.
- Wave F (analytics/ops): 27-32.
- Wave G (jobs/docs/frontend): 33-36.
- Wave H (verification/docs): 37-39.
- Final verification wave: F1-F4 in parallel after todo 39.

### Dependency matrix

| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | - | 2-39 | - |
| 2 | 1 | 3-39 | - |
| 3 | 2 | 4-38 | 7 |
| 4 | 2,3 | 5,12,34 | 7 |
| 5 | 3,4 | 6,12-32 | 7 |
| 6 | 5 | 12-32,39 | 7-11 |
| 7 | 1,2 | 8-11,38 | 3-6 |
| 8 | 7 | 9,11 | 10 |
| 9 | 7,8 | 19,25,29,35,38 | 10,11 |
| 10 | 7 | 38 | 8,9,11 |
| 11 | 7,8 | 12,38 | 9,10 |
| 12 | 5,6,11 | 13-32 | 13,14 |
| 13 | 5,6,7 | 14 | 12 |
| 14 | 6,7,9,13 | 15,25 | 12 |
| 15 | 6,7,9 | 16 | 13 |
| 16 | 6,9,15 | 19,20 | 17,18 |
| 17 | 6,7 | 18 | 16 |
| 18 | 6,7 | 19 | 16,17 |
| 19 | 6,9,10,16 | 25,27 | 18 |
| 20 | 6,16,18 | 26,27 | 17 |
| 21 | 6,9 | 22,23 | 24 |
| 22 | 6,9,21 | 23 | 24-26 |
| 23 | 6,8,21 | 27 | 22 |
| 24 | 6,7 | 25 | 21 |
| 25 | 6,9,24 | 26 | 21,22 |
| 26 | 6,8,9 | 27 | 23 |
| 27 | 6,8,23 | 28 | 26 |
| 28 | 6,8,27 | 29 | 26 |
| 29 | 6,8,28 | 37 | 30 |
| 30 | 6,7 | 31,32 | 27-29 |
| 31 | 6,7 | 32 | 30 |
| 32 | 6,8 | 37 | 30,31 |
| 33 | 6,7,30,31 | 38 | 34-36 |
| 34 | 6,12-32 | 37 | 33,35,36 |
| 35 | 1 | 36 | 33,34 |
| 36 | 35 | 39 | 33,34 |
| 37 | 33,34 | 39 | 35,36 |
| 38 | 7-11,33 | 39 | 37 |
| 39 | 35,36,37,38 | F1-F4 | - |

## Todos

> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [x] 1. Create root `.gitignore` and document the local SQL Server 2025 dev target
  What to do / Must NOT do: initialize version control if absent (`git init -b main`; the working directory is not a repo yet) and make the first commit at the end of this todo. `.gitignore` covers `node_modules/`, `dist/`, `.env`, `.env.*` except `.env.example`, `.DS_Store`, `*.log`. Do NOT create `docker-compose.yml` or any Dockerfile: SQL Server 2025 is already installed natively on this machine (user-confirmed), so dev and production use the same engine and there is no install step. The README written in todo 37 must describe the dev-DB expectations: start the local SQL Server service, ensure mixed-mode auth and a reachable TCP port (default 1433), copy `backend/.env.example` to `backend/.env` and fill `DB_PASSWORD` with the local `sa` (or dedicated login) password, then run the five scripts in order with `sqlcmd`; if the instance listens on a non-default port, `DB_PORT` reflects it, and the section carries a `# ponytail: local SQL Server already installed; no container, no install step` comment.
  Parallelization: Wave A | Blocked by: none | Blocks: 2-39
  References: `TSD.md:72-80`; user statement "sudah install sql server 2025 sebelumnya"; `.omo/drafts/praktik-bidan-monorepo.md` decisions 19 (superseded) and 22.
  Acceptance criteria: `.git` exists on branch `main`; `.gitignore` exists with the listed patterns; no `docker-compose.yml` or Dockerfile exists anywhere in the tree; `grep -rn "mcr.microsoft.com" .` (excluding `.git`) returns nothing. The README wording itself is verified in todo 37.
  QA scenarios: happy - create scratch `.env` and `dist/x`, `git status --porcelain` stays empty for them, then remove; failure - a scratch `docker-compose.yml` added to the tree is caught by the scope check in F4. Evidence `.omo/evidence/task-1-praktik-bidan-monorepo.txt`
  Commit: Y | `chore(root): initialize git and ignore build/env artifacts`

- [x] 2. Create `backend/package.json`, `backend/tsconfig.json`, `backend/.env.example`
  What to do / Must NOT do: dependencies exactly `express@^4.21.0`, `cors`, `helmet@^7.0.0`, `express-rate-limit@^7.0.0`, `dotenv`, `zod@^3.23.0`, `jsonwebtoken@^9.0.0`, `bcrypt@^5.1.1`, `mssql@^11.0.0`, `node-cron@^3.0.3`, `pdfkit@^0.15.0`, `exceljs@^4.4.0`, `axios`. devDependencies: `typescript@^5.6.0`, `tsx@^4.19.0`, `tsc-alias`, `@types/node`, `@types/express`, `@types/cors`, `@types/jsonwebtoken`, `@types/bcrypt`, `@types/mssql`, `@types/node-cron`, `@types/pdfkit`. Scripts: `dev` = `tsx watch src/server.ts`, `build` = `tsc && tsc-alias`, `start` = `node dist/server.js`, `typecheck` = `tsc --noEmit`, `audit:routes` = `tsx src/scripts/route-audit.ts`. tsconfig: target `ES2022`, module `commonjs`, moduleResolution `node`, `strict`, `esModuleInterop`, `skipLibCheck`, `resolveJsonModule`, `outDir: "./dist"`, `rootDir: "./src"`, `baseUrl: "."`, `paths: {"@/*": ["src/*"]}`, include `["src/**/*.ts", "src/**/*.d.ts"]`, exclude `["node_modules", "dist"]`. No `"type": "module"`. `.env.example` with concrete dev values: `NODE_ENV=development`, `PORT=3000`, `TZ=Asia/Jakarta`, `DB_HOST=localhost`, `DB_PORT=1433`, `DB_NAME=PraktikBidan`, `DB_USER=sa`, `DB_PASSWORD=CHANGE_ME`, `DB_ENCRYPT=false`, `DB_TRUST_CERT=true`, `DB_POOL_MAX=10`, `JWT_SECRET=change-me-min-32-chars`, `JWT_EXPIRES_IN=1800`, `MAX_FAILED_LOGIN=5`, `LOCKOUT_DURATION=900`, `OTP_TTL=600`, `RATE_LIMIT_PUBLIC=10`, `WA_API_URL=https://example.invalid/wa`, `WA_API_TOKEN=change-me`, `CRON_REMINDER_H1=0 8 * * *`, `CRON_INVENTORY_WEEKLY=0 7 * * 1`, `CORS_ORIGINS=http://localhost:5173`. `DB_PASSWORD=CHANGE_ME` is a placeholder: the developer's real local-instance password goes only into the gitignored `backend/.env`, never into the example or the README.
  Parallelization: Wave A | Blocked by: 1 | Blocks: 3-39
  References: user request Bagian 1.1; `TSD.md:78`; `TSD.md:229-231`.
  Acceptance criteria: `cd backend && npm install` exits 0; `node -e "const p=require('./package.json'); for (const d of ['express','zod','mssql','bcrypt','pdfkit','exceljs']) if(!p.dependencies[d]) process.exit(1)"` exits 0.
  QA scenarios: happy - `npm install` then `node -e "require('mssql'); require('bcrypt'); console.log('ok')"`; failure - remove `zod` from deps, `npm ls zod` fails, then restore. Evidence `.omo/evidence/task-2-praktik-bidan-monorepo.txt`
  Commit: Y | `chore(backend): scaffold package and TypeScript config`

- [x] 3. Create backend types and response/error utilities
  What to do / Must NOT do: `src/types/api.ts` exports `Role = 'BIDAN' | 'ADMIN'`, `AuthUser { user_id; username; role }`, `PaginationMeta { current_page; per_page; total; last_page }`, and `ApiResponse<T>` as a discriminated union matching the TSD envelope. `src/types/express.d.ts` augments `Express.Request` with `user?: AuthUser` and `Express.Locals` with `db?: import('mssql').ConnectionPool`. `src/utils/errors.ts` exports `ERROR_CATALOG` for every code in the table above (http + default message), `class AppError extends Error { code; http; errors? }`, `isAppError`. `src/utils/response.ts` exports `ok<T>(res, data, message, meta?)` and `fail(res, error)` emitting the exact envelopes. `src/utils/pagination.ts` exports `parsePagination(body)` clamping `per_page` 1..100 default 15 and `current_page` >= 1, throwing `AppError('ERR-VAL-03')` for non-numeric/out-of-contract values, plus `buildMeta`. Do NOT invent codes outside the catalogue.
  Parallelization: Wave A | Blocked by: 2 | Blocks: 4-38
  References: user request Bagian 3 envelope + error list; `TSD.md:100-108`; error catalogue above.
  Acceptance criteria: `cd backend && npx tsc --noEmit` exits 0; a node assertion over `dist/utils/errors.js` confirms every catalogue code exists with a numeric HTTP.
  QA scenarios: happy - `ok` emits `status:'success'` and `meta` only when passed; failure - `parsePagination({per_page:500})` returns 100, `parsePagination({per_page:0})` returns 15. Evidence `.omo/evidence/task-3-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add typed envelope and error catalogue`

- [x] 4. Create backend infrastructure: env, db pool, jwt, password, otp, WhatsApp
  What to do / Must NOT do: `src/config/env.ts` validates `process.env` with Zod (required DB_* and `JWT_SECRET`; numeric coercions; `DB_POOL_MAX` default 10; `JWT_EXPIRES_IN` default 1800; `CORS_ORIGINS` split on comma) and fail-fasts with the missing key. `src/utils/db.ts` lazily creates one `sql.ConnectionPool` (encrypt and trustServerCertificate from env, pool.max from env) and exports `getPool()`, `acquire()`, `release(conn)`, `withTransaction(fn)`. `src/utils/jwt.ts` signs HS256 with `{sub, username, role}` and expiry in seconds; verify distinguishes expired from invalid. `src/utils/password.ts` wraps bcrypt cost 12. `src/utils/otp.ts` generates 6 digits with `crypto.randomInt`, hashes with bcrypt cost 10, constant-time compare. `src/utils/wa.ts` posts `{target, message}` to `WA_API_URL` with Bearer `WA_API_TOKEN`, 10s timeout, throws a typed error on non-2xx/timeout. Do NOT set session context here.
  Parallelization: Wave A | Blocked by: 2,3 | Blocks: 5,12,34
  References: `.env.example` above; `TSD.md:78-80`; `TSD.md:112-123`.
  Acceptance criteria: `npx tsc --noEmit`; missing `DB_HOST` exits non-zero naming the key; a signed token round-trips and an expired token hits the expired branch.
  QA scenarios: happy - `JWT_SECRET=test npx tsx -e "..."` sign/verify; failure - `WA_API_URL=http://127.0.0.1:1` rejects within 11s. Evidence `.omo/evidence/task-4-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add env, db, jwt, password and wa infrastructure`

- [x] 5. Create Express app, server bootstrap and all middlewares
  What to do / Must NOT do: `authMiddleware` verifies `Authorization: Bearer`, sets `req.user`, returns 401 `ERR-AUTH-02` (missing/invalid) or `ERR-AUTH-04` (expired); `checkRole(...roles)` returns 403 `ERR-AUTH-03`. `dbSessionContext` acquires one pooled connection, runs `EXEC sp_set_session_context @key=N'user_id', @value=@uid; EXEC sp_set_session_context @key=N'ip', @value=@ip;` on it with NVarChar params, stores it in `res.locals.db`, releases exactly once on `finish`/`close`. `validate({body?, params?})` maps Zod failures to 422 `ERR-VAL-01`/`ERR-VAL-02` with `errors: [{path, message}]`. `rateLimit` uses `express-rate-limit` v7 `{ windowMs: 60000, limit: env.RATE_LIMIT_PUBLIC, standardHeaders: 'draft-7', legacyHeaders: false }` and responds 429 `ERR-SYS-03`. `errorHandler` maps AppError, ZodError, body SyntaxError (`ERR-VAL-04` 400), mssql errors whose message starts with `ERR-` (via `err.message.split('|')[0]`), RequestError/ConnectionError to `ERR-SYS-02`, else `ERR-SYS-01`; no stack leakage in production. `notFound` returns 404 `ERR-SYS-01`. `src/app.ts`: helmet, cors with the env allowlist (no wildcard), `express.json({ limit: '1mb' })`, `app.set('trust proxy', 1)`, `/api/v1` router, notFound, errorHandler. `src/server.ts`: listen, `startJobs()`, graceful SIGTERM pool close. Use `@/*` imports.
  Parallelization: Wave A | Blocked by: 3,4 | Blocks: 6,12-32
  References: user request Bagian 3 middlewares; `TSD.md:86-108`; `TSD.md:224-227`.
  Acceptance criteria: `npx tsc --noEmit && npm run build`; `PORT=4100 node dist/server.js` logs the port; malformed JSON returns 400 `ERR-VAL-04`; `grep -rn "app.get(" src` returns nothing.
  QA scenarios: happy - after todo 6, curl public list returns a typed envelope; failure - `Authorization: Bearer x` returns 401 `ERR-AUTH-02`; body `{` returns 400 `ERR-VAL-04`. Evidence `.omo/evidence/task-5-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add express app, middlewares and server bootstrap`

- [x] 6. Create route index, 11 module router skeletons and `src/scripts/route-audit.ts`
  What to do / Must NOT do: `src/routes/index.ts` mounts `/auth`, `/public`, `/pasien`, `/reservasi`, `/sesi`, `/alergi`, `/kunjungan`, `/tagihan`, `/keuangan`, `/inventaris`, `/harga`, `/laporan`, `/konten`, `/notifikasi`, `/audit-logs` under `/api/v1`. Protected routers use `router.use(authMiddleware, dbSessionContext)`; the public router uses `router.use(publicRateLimiter, dbSessionContext)`. Register exactly the 51 method+path pairs from the inventory; controllers may be one-line stubs throwing `AppError('ERR-SYS-01')` until their todo lands. `src/scripts/route-audit.ts` sets safe env defaults (`JWT_SECRET`, `DB_HOST`, etc.) BEFORE requiring `../app` (use `require`, not a static import, because CJS import ordering is hoisted), recursively walks `app._router.stack`, prints sorted `METHOD /api/v1/...`, asserts zero GET, prints the total, exits 1 on GET or total !== 51. No health/docs route.
  Parallelization: Wave A | Blocked by: 5 | Blocks: 12-32,39
  References: endpoint inventory above; `TSD.md:86-170`.
  Acceptance criteria: `npm run audit:routes` prints 51 lines and exits 0; `npm run build` passes; grep shows only post/patch/put/delete registrations.
  QA scenarios: happy - audit count 51, zero GET; failure - add a temporary `app.get('/x')` and confirm exit 1, then revert. Evidence `.omo/evidence/task-6-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): register 51 non-GET routes with audit script`

- [x] 7. Create `database/01_schema.sql` (database + 18 tables + constraints + indexes + DB user block)
  What to do / Must NOT do: idempotent `IF DB_ID(N'PraktikBidan') IS NULL CREATE DATABASE PraktikBidan; GO USE PraktikBidan;`, then the 18 tables in FK order: users, otp_reset, pasien, sesi_praktik, layanan, item_inventaris, konten_publik, reservasi, kunjungan, resep_item, alergi_kondisi, riwayat_stok, riwayat_harga, tagihan, tagihan_rincian, pembayaran, log_notifikasi, audit_logs. PKs `UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID()` except `audit_logs.log_id BIGINT IDENTITY(1,1)`. Columns and CHECKs exactly as the request Bagian 1.2: role enum, `failed_attempts` 0..5, kategori enums, status enums, `metode_daftar`, `ref_tipe`, `jumlah > 0`, `stok >= 0`, `retry_count` 0..3, `tagihan_rincian.subtotal AS (qty * harga_satuan) PERSISTED`, `tagihan.kunjungan_id UNIQUE`, `pasien.nik CHAR(16) UNIQUE`, `layanan.nama UNIQUE`, `otp_reset.user_id` FK ON DELETE CASCADE, `tagihan_rincian.tagihan_id` FK ON DELETE CASCADE, `audit_logs.user_id` FK ON DELETE SET NULL, self-FK `kunjungan.koreksi_dari_id`, nullable `alergi_kondisi.item_id`. Filtered unique index `UX_reservasi_sesi_antrean ON reservasi(sesi_id, nomor_antrean) WHERE status <> 'DIBATALKAN'`. Supporting indexes on pasien(nik), pasien(no_telepon), reservasi(sesi_id,status), kunjungan(pasien_id,tanggal_kunjungan), kunjungan(bidan_id), riwayat_stok(item_id,tanggal), riwayat_harga(ref_tipe,item_id,layanan_id,berlaku_dari), pembayaran(tagihan_id), audit_logs(created_at), log_notifikasi(status,jenis). `audit_logs.nilai_lama/nilai_baru` nullable NVARCHAR(MAX) with `CHECK (x IS NULL OR ISJSON(x) = 1)`. Data-shape CHECKs: `riwayat_harga` requires exactly one of `item_id`/`layanan_id` matching `ref_tipe`; `tagihan_rincian` requires exactly one of `item_id`/`layanan_id`; `log_notifikasi.reservasi_id` nullable (INVENTARIS/OTP have none); `resep_item` has no unique (kunjungan_id,item_id) so duplicate rows are allowed and aggregated by the SP. Document that users are soft-deleted, so the `audit_logs` FK `ON DELETE SET NULL` never conflicts with the immutability trigger. End with a commented block creating `DB_APP_USER` and `DENY UPDATE, DELETE ON dbo.audit_logs TO DB_APP_USER` plus a note that the DBA maps a login. Use `IF OBJECT_ID(...) IS NULL`, never `CREATE OR ALTER` here.
  Parallelization: Wave B | Blocked by: 1,2 | Blocks: 8-11,38
  References: user request Bagian 1.2 tables 1-18; `TSD.md:174-204`; draft decision 16.
  Acceptance criteria: sqlcmd run exits 0; `SELECT COUNT(*) FROM sys.tables WHERE name IN (...18...)` = 18; re-run exits 0; `SELECT name FROM sys.indexes WHERE name='UX_reservasi_sesi_antrean' AND has_filter=1` returns one row.
  QA scenarios: happy - run twice, both exit 0; failure - insert duplicate NIK fails; insert duplicate active (sesi_id, nomor_antrean) fails. Evidence `.omo/evidence/task-7-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(db): add schema for 18 tables with constraints and indexes`

- [x] 8. Create `database/02_functions_views.sql` (4 scalar functions + 14 views)
  What to do / Must NOT do: functions `CREATE OR ALTER`, schema-qualified: `fn_hitung_estimasi_jam(@sesi_id UNIQUEIDENTIFIER, @nomor_antrean INT) RETURNS TIME(0)` = jam_mulai + (n-1) * durasi, NULL when unknown; `fn_status_stok(@item_id)` returns `HABIS`/`KEDALUWARSA`/`MENIPIS`/`AMAN` (expiry before menipis; unknown item returns HABIS); `fn_harga_berlaku(@ref_tipe VARCHAR(10), @ref_id UNIQUEIDENTIFIER, @tanggal DATE) RETURNS DECIMAL(18,2)` = latest row with `berlaku_dari <= @tanggal AND (berlaku_sampai IS NULL OR berlaku_sampai >= @tanggal)`; `fn_cek_alergi(@pasien_id, @item_id) RETURNS BIT` = 1 when an active ALERGI_OBAT row exists. Views `CREATE OR ALTER VIEW`: v_antrean_harian (today Asia/Jakarta), v_tagihan_belum_lunas, v_rekap_pendapatan (per date + jalur), v_inventaris_status (item + fn_status_stok + days_to_expiry), v_harga_berlaku (union item/layanan current price), v_rekap_kunjungan_harian, v_tren_layanan (per month + layanan), v_jam_tersibuk (last 30 days by hour of estimasi_jam), v_penjualan_item_periode (tagihan_rincian items), v_audit_log_detail (+ username), v_sesi_sisa_kuota (kuota minus active reservations), v_profil_rme (patient + visit count + last visit + active flag count), v_tagihan_detail (+ rincian + paid + sisa), v_riwayat_stok_item (+ item + username). Use `SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00')` for today. Reference only tables from todo 7.
  Parallelization: Wave B | Blocked by: 7 | Blocks: 9,11
  References: user request Bagian 1.2 objects; `TSD.md:205-206`; `TSD.md:229-231`.
  Acceptance criteria: file executes; `SELECT name FROM sys.objects WHERE type IN ('FN','V')` includes the 4 function and 14 view names; `SELECT dbo.fn_status_stok((SELECT TOP 1 item_id FROM item_inventaris))` returns a known string; re-run exits 0.
  QA scenarios: happy - `SELECT * FROM dbo.v_sesi_sisa_kuota` returns rows after seed; failure - `SELECT dbo.fn_harga_berlaku('ITEM', NEWID(), '2020-01-01')` returns NULL without error. Evidence `.omo/evidence/task-8-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(db): add scalar functions and 14 reporting views`

- [x] 9. Create `database/03_stored_procedures.sql` (TVP + 6 procedures)
  What to do / Must NOT do: `dbo.tvp_resep (item_id UNIQUEIDENTIFIER, jumlah DECIMAL(10,2), aturan_pakai NVARCHAR(100))`. Every SP uses `SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRY BEGIN TRAN ... COMMIT END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; THROW; END CATCH`. Lock sesi/tagihan/item rows `WITH (UPDLOCK, HOLDLOCK)`; allocate `nomor_antrean` inside the lock from active rows only. Raise business errors as `THROW 50xxx, N'ERR-XXX-NN|<message>', 1` with mapping 50001 RSV-01, 50002 RSV-02, 50003 RSV-03, 50004 RSV-04, 50005 RSV-05, 50006 RME-01, 50007 RME-02, 50008 RME-04, 50009 INV-01, 50010 INV-02, 50011 FIN-01, 50012 FIN-02, 50013 PRC-01, 50014 VAL-01.
  Signatures: `sp_buat_reservasi @pasien_id UNIQUEIDENTIFIER=NULL, @nik CHAR(16)=NULL, @nama NVARCHAR(100)=NULL, @tgl_lahir DATE=NULL, @alamat NVARCHAR(255)=NULL, @no_telepon NVARCHAR(20)=NULL, @sesi_id, @layanan_id, @metode_daftar VARCHAR(20)='ONLINE', @dibuat_oleh UNIQUEIDENTIFIER=NULL, @ip VARCHAR(45)=NULL` returns `(reservasi_id, nomor_antrean, estimasi_jam)`; validates active/future session, quota, reuses an existing patient by `@pasien_id` OR by matching `@nik` (never duplicate a NIK), and rejects a duplicate active reservation. `sp_reschedule_reservasi @reservasi_id, @sesi_baru UNIQUEIDENTIFIER=NULL, @alasan, @user_id, @ip` cancels or moves, then renumbers the origin session's remaining active rows 1..N and recomputes `estimasi_jam`; renumbering MUST be two-phase (`nomor_antrean = nomor_antrean + 1000`, then assign final `ROW_NUMBER()` values) because SQL Server enforces the filtered unique index per row during a single UPDATE. Returns `(reservasi_id, nomor_antrean, estimasi_jam, status)`. `sp_simpan_kunjungan @pasien_id, @reservasi_id=NULL, @bidan_id, @layanan_id, @tanggal_kunjungan DATETIME2, @keluhan, @pemeriksaan_fisik, @diagnosis, @tindakan, @catatan_bebas=NULL, @koreksi_dari_id=NULL, @resep dbo.tvp_resep READONLY` validates patient/layanan price, rejects any item with `fn_cek_alergi = 1`, aggregates duplicate TVP rows by `item_id` (SUM jumlah) before any check, then locks items in ascending `item_id` order (deadlock avoidance), rejects insufficient stock, inserts kunjungan/resep_item, deducts stock, inserts riwayat_stok PAKAI, creates tagihan + rincian (layanan qty 1 + each aggregated item qty) using `fn_harga_berlaku` snapshots, marks the reservasi SELESAI when given; returns `(kunjungan_id, tagihan_id, total_tagihan)`. `sp_catat_pembayaran @tagihan_id, @jumlah, @jalur, @dicatat_oleh, @ip` locks the bill, rejects overpayment, inserts, updates totals/status; returns `(tagihan_id, total_tagihan, total_dibayar, status)`. `sp_restock_item @item_id, @jumlah, @harga_beli=NULL, @tgl_kedaluwarsa=NULL, @user_id, @ip` updates stock and optional expiry, inserts RESTOCK; returns `(item_id, stok)`. `sp_ubah_harga @ref_tipe, @ref_id, @harga, @berlaku_dari, @alasan, @diubah_oleh, @ip` validates, closes the open price at `DATEADD(day,-1,@berlaku_dari)`, inserts the new row; returns `(harga_id, berlaku_dari)`. No read-only SPs.
  Parallelization: Wave B | Blocked by: 7,8 | Blocks: 19,25,29,35,38
  References: user request Bagian 1.3; `TSD.md:207-213`; draft decisions 10-14.
  Acceptance criteria: file executes; `SELECT COUNT(*) FROM sys.procedures WHERE name LIKE 'sp[_]%'` = 6 and `sys.types` has `tvp_resep`; booking beyond quota raises a message starting `ERR-RSV-01|`.
  QA scenarios: happy - fill quota then the next call fails; reschedule then `SELECT nomor_antrean ... ORDER BY 1` is contiguous; failure - overpay returns `ERR-FIN-02|`; allergic item returns `ERR-RME-04|`; insufficient stock returns `ERR-INV-02|`. Evidence `.omo/evidence/task-9-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(db): add atomic stored procedures and resep TVP`

- [x] 10. Create `database/04_triggers.sql` (15 audit triggers + immutability trigger)
  What to do / Must NOT do: exactly 15 `AFTER INSERT, UPDATE, DELETE` triggers named `trg_audit_<table>` on users, pasien, sesi_praktik, layanan, reservasi, kunjungan, resep_item, alergi_kondisi, item_inventaris, riwayat_stok, riwayat_harga, tagihan, tagihan_rincian, pembayaran, konten_publik. Excluded with a comment: otp_reset, log_notifikasi, audit_logs. Each trigger inserts one audit row per affected PK using `(SELECT <cols> FROM inserted i WHERE i.<pk> = x.<pk> FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)` and the deleted equivalent; `aksi` = CREATE/UPDATE/DELETE from which pseudo-table has the row; `user_id = TRY_CAST(SESSION_CONTEXT(N'user_id') AS UNIQUEIDENTIFIER)`; `user_ref` from users lookup; `ip_address = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45))`; `entitas` = table name; `entitas_id` = PK as NVARCHAR(64). Set-based for multi-row statements, no cursors. The `users` trigger JSON MUST use an explicit column list that excludes `password_hash` (audit logs are readable by BIDAN; secrets must never enter them) - `SELECT user_id, username, nama_lengkap, role, no_telepon, is_active, last_login_at, created_at`. Add `trg_audit_logs_immutable` as `INSTEAD OF UPDATE, DELETE` on audit_logs: `RAISERROR('audit_logs bersifat append-only', 16, 1); ROLLBACK TRANSACTION;`. `CREATE OR ALTER TRIGGER`. Do not audit OTP hashes or notification payloads.
  Parallelization: Wave B | Blocked by: 7 | Blocks: 38
  References: user request Bagian 1.4; `TSD.md:214`; draft decisions 7 and 10.
  Acceptance criteria: file executes; `SELECT COUNT(*) FROM sys.triggers WHERE name LIKE 'trg_audit[_]%'` = 15; updating a user inside a session with `sp_set_session_context` produces exactly one audit row with valid JSON `nilai_baru` and `aksi='UPDATE'`.
  QA scenarios: happy - multi-row `UPDATE layanan SET is_active = is_active` produces one audit row per affected row; failure - `UPDATE audit_logs SET aksi='x'` raises append-only and rolls back; `DELETE FROM audit_logs` same. Evidence `.omo/evidence/task-10-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(db): add 15 audit triggers and immutable audit guard`

- [x] 11. Create `database/05_seed.sql`
  What to do / Must NOT do: idempotent via `IF NOT EXISTS` per natural key. Set `sp_set_session_context` user_id NULL and ip `127.0.0.1` before writes. Users `bidan`/`Bidan#2026` (BIDAN) and `admin`/`Admin#2026` (ADMIN) with real bcrypt cost-12 hashes generated during implementation. At least 6 layanan (KEBIDANAN and UMUM), at least 8 inventory items (OBAT/PRODUK_KESEHATAN) including one below minimum and one expiring within 3 months. `riwayat_harga` open prices (`berlaku_sampai IS NULL`) for every layanan and item. Five sesi_praktik dated +1..+5 days with kuota and durasi 15. konten_publik rows PROFIL, LAYANAN, KONTAK, GALERI, TESTIMONI (testimonial initials only). Do NOT insert reservations/visits and never store plaintext passwords.
  Parallelization: Wave B | Blocked by: 7,8 | Blocks: 12,38
  References: user request Bagian 1.5; `TSD.md:66`; `TSD.md:198`; seed decision in the draft.
  Acceptance criteria: file executes and re-runs cleanly; 2 users with distinct hashes; `bcrypt.compareSync('Bidan#2026', storedHash)` is true; every layanan/item has an open price row.
  QA scenarios: happy - login with seed credentials succeeds once the API is up; failure - re-running does not duplicate (user count stays 2). Evidence `.omo/evidence/task-11-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(db): seed users, services, inventory, prices, sessions and content`

- [x] 12. Implement Auth module (endpoints 1-5)
  What to do / Must NOT do: validators (login username 3..50 + password min 8; reset request username; reset verify username + 6-digit kode + new password min 8); repository (find by username, increment failures and lock, reset counters, update password, OTP insert/find/consume); service (if `locked_until > now` return LOCK-01; wrong password increments `failed_attempts`, the 5th failure sets `locked_until = now + 15 minutes` and returns LOCK-01, earlier failures return AUTH-01; inactive returns AUTH-05; success resets counters and sets `last_login_at`; logout is stateless success; refresh re-issues a 30-minute token from `req.user`; OTP request invalidates prior unused codes, stores a bcrypt hash with `expired_at = now + OTP_TTL`, sends WA, and writes `log_notifikasi` jenis OTP with TERKIRIM/GAGAL without failing the request; verify checks the latest unused unexpired hash, updates the password, clears the lock). Controllers and `routes/auth.routes.ts`: `router.use(publicRateLimiter)` and `router.use(dbSessionContext)` for the whole router (login writes failed_attempts and its trigger needs the session context); `/login`, `/reset/request`, `/reset/verify` public; `/logout`, `/refresh` behind `authMiddleware`. Token in JSON only, no cookies. Reset request always returns the same message whether the username exists or not.
  Parallelization: Wave C | Blocked by: 5,6,11 | Blocks: 13-32
  References: user request endpoints 1-5 + lockout; `TSD.md:51`; `TSD.md:113-117`; `TSD.md:220-227`.
  Acceptance criteria: `npm run build`; with DB, `curl -s -X POST .../auth/login -d '{"username":"bidan","password":"Bidan#2026"}'` returns 200 with `data.token`; 5 wrong attempts then a 6th returns 423 `ERR-LOCK-01`; logout with the token returns 200.
  QA scenarios: happy - login, refresh, logout chain; failure - wrong password 401 AUTH-01; expired token 401 AUTH-04; role-less/invalid token 401 AUTH-02. Evidence `.omo/evidence/task-12-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): implement authentication and OTP reset`

- [x] 13. Implement public content, services and session endpoints (6-8)
  What to do / Must NOT do: validators for pagination plus optional `tipe` (konten), `kategori` (layanan), `tanggal_dari`/`tanggal_sampai` (sesi); repositories read `konten_publik` where `is_published = 1` ordered by `urutan`, `layanan` where `is_active = 1`, and `v_sesi_sisa_kuota` where `is_active = 1 AND tanggal >= today` ordered by date/time. Services, controllers and routes on the public router for `POST /public/konten/list`, `/public/layanan/list`, `/public/sesi/list`. Every list returns `meta`. Public field whitelist only. Do not reuse the admin handlers.
  Parallelization: Wave C | Blocked by: 5,6,7 | Blocks: 14
  References: user request endpoints 6-8; `TSD.md:118-121`; `TSD.md:52`.
  Acceptance criteria: `npm run audit:routes` still 51; with DB each endpoint returns `status:'success'` with `meta.current_page = 1`; `per_page: 500` clamps to 100.
  QA scenarios: happy - konten filter `tipe=TESTIMONI`; failure - `per_page:"abc"` returns 422 `ERR-VAL-03`; unpublished content never appears. Evidence `.omo/evidence/task-13-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add public content, service and session endpoints`

- [ ] 14. Implement public patient lookup and online reservation (9-10)
  What to do / Must NOT do: `POST /public/pasien/cek` accepts exactly one of `nik` (16 digits) or `no_telepon`, returns `{ terdaftar, pasien_id?, nama_samaran?, has_red_flag? }` where `nama_samaran` keeps the first word and initials the rest (`R*** A***`); never return NIK, address, or diagnosis. `POST /public/reservasi` accepts `pasien_id` OR `pasien_baru {nik, nama, tgl_lahir, alamat, no_telepon}` (Zod discriminated union) plus `sesi_id` and `layanan_id`; calls `sp_buat_reservasi` with `@metode_daftar = 'ONLINE'` and `@ip = req.ip`; on success inserts `log_notifikasi` KONFIRMASI ANTRE and fires a non-blocking WA send that updates the row to TERKIRIM/GAGAL. Map SP error tokens to AppError. Do not bypass SP validation.
  Parallelization: Wave C | Blocked by: 6,7,9,13 | Blocks: 15,25
  References: user request endpoints 9-10; `TSD.md:41`; `TSD.md:52`; `TSD.md:122-123`; draft decisions 12 and 15.
  Acceptance criteria: with DB, a fresh session reservation returns 201 with `nomor_antrean = 1` and `estimasi_jam = jam_mulai`; a second reservation for the same patient+session returns 409 `ERR-RSV-02`; `pasien/cek` returns a masked name without `nik`.
  QA scenarios: happy - create with a new patient then check by phone; failure - invalid NIK returns 422 `ERR-VAL-01`; full quota returns 409 `ERR-RSV-01`. Evidence `.omo/evidence/task-14-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add public patient lookup and reservation`

- [ ] 15. Implement patient identity list and admin walk-in (11-12)
  What to do / Must NOT do: `POST /pasien/identitas/list` (ADMIN, BIDAN) filters `q` over nama/nik/no_telepon plus pagination and returns identity fields only. `POST /pasien/walk-in` (ADMIN) accepts `pasien_id` OR `pasien_baru` plus `sesi_id`/`layanan_id`; calls `sp_buat_reservasi` with `@metode_daftar = 'MANUAL_ADMIN'` and `@dibuat_oleh = req.user.user_id`; returns the reservation and patient. Reuse the todo-14 patient repository. ADMIN must never receive RME fields.
  Parallelization: Wave D | Blocked by: 6,7,9 | Blocks: 16
  References: user request endpoints 11-12; `TSD.md:124-126`; `TSD.md:225`.
  Acceptance criteria: audit:routes 51; walk-in as admin returns 201 with `metode_daftar = 'MANUAL_ADMIN'`; identity list works for admin and bidan; no token returns 401.
  QA scenarios: happy - walk-in with an existing patient; failure - admin calls `/pasien/list` returns 403 `ERR-AUTH-03`; inactive/unknown sesi returns 422 `ERR-RSV-05`. Evidence `.omo/evidence/task-15-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add patient identity list and walk-in registration`

- [ ] 16. Implement reservation list, reschedule, cancel and status transition (13-15, 19)
  What to do / Must NOT do: `/reservasi/list` filters tanggal/sesi_id/status/pasien_id/q plus pagination, ordered by session date and `estimasi_jam`. `PATCH /reservasi/:id/jadwal` (ADMIN) body `{ sesi_id_baru, alasan }` calls `sp_reschedule_reservasi`; `PATCH /reservasi/:id/batal` (ADMIN) body `{ alasan }` calls it with NULL. `PATCH /reservasi/:id/status` (BIDAN) accepts only MENUNGGU to DIPANGGIL, DIPANGGIL to SELESAI, and DIPANGGIL back to MENUNGGU; anything else returns 409 `ERR-RSV-04`. Direct UPDATE for status only (the trigger audits it). BIDAN must not reschedule.
  Parallelization: Wave D | Blocked by: 6,9,15 | Blocks: 19,20
  References: user request endpoints 13-15 and 19; `TSD.md:127-133`; `TSD.md:209`.
  Acceptance criteria: reschedule moves the row and renumbers the origin session contiguously; cancel frees the slot and renumbers the remaining active rows 1..N (per TSD "susun ulang antrean"); invalid transition returns 409.
  QA scenarios: happy - book queues 1,2,3, cancel #2, then the list shows exactly 1,2 and the next booking receives 3; failure - cancel an already-cancelled reservation returns 409 `ERR-RSV-04`. Evidence `.omo/evidence/task-16-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add reservation list, reschedule, cancel and status`

- [x] 17. Implement session list, create and update (16-18)
  What to do / Must NOT do: `POST /sesi/list` (ADMIN) filters date range/is_active plus pagination. `POST /sesi` (ADMIN) body `{ tanggal, jam_mulai, jam_selesai, kuota_maks, durasi_per_pasien? }` with Zod refinements: `jam_selesai > jam_mulai`, kuota 1..200, durasi 5..60 default 15, no overlap on the same date (409 `ERR-RSV-02`). `PATCH /sesi/:id` (ADMIN) partial; reject `kuota_maks` below the current active reservation count with 409 `ERR-RSV-01`; `is_active = false` does not cancel bookings. No session delete.
  Parallelization: Wave D | Blocked by: 6,7 | Blocks: 18
  References: user request endpoints 16-18; `TSD.md:130-133`.
  Acceptance criteria: create then list shows it; overlapping create returns 409; quota reduction below booked returns 409; audit trigger writes session rows.
  QA scenarios: happy - create 09:00-12:00 kuota 10 durasi 15; failure - create 11:00-13:00 same date returns 409; `jam_selesai < jam_mulai` returns 422 `ERR-VAL-01`. Evidence `.omo/evidence/task-17-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add session management endpoints`

- [x] 18. Implement RME list, detail, allergy CRUD and red-flag confirmation (20-24)
  What to do / Must NOT do: `POST /pasien/list` (BIDAN) adds `has_red_flag` from active `alergi_kondisi` (ALERGI_OBAT or KEHAMILAN_RISTI) plus last visit date. `POST /pasien/:id/rme/detail` returns profile, active allergies, red-flag status, and visits with resep items newest first; before responding insert `audit_logs` `aksi='VIEW_RME'`, `entitas='pasien'`, `entitas_id=:id`, user/ip from the request, `nilai_baru=NULL`. `POST /pasien/:id/alergi` body `{ kategori, nama, item_id?, keterangan? }`; ALERGI_OBAT requires `item_id`, other categories reject it. `PATCH /alergi/:id` body `{ is_active?, keterangan? }`. `POST /pasien/:id/red-flag/konfirmasi` inserts `audit_logs` `aksi='RED_FLAG_CONFIRMED'` with `nilai_baru` = JSON snapshot of the active flags at confirmation time, and returns `{ confirmed: true, confirmed_at }`. ADMIN gets 403 on every route in this todo. No new confirmation table.
  Parallelization: Wave D | Blocked by: 6,7 | Blocks: 19
  References: user request endpoints 20-24; `TSD.md:54`; `TSD.md:134-139`; `TSD.md:224-225`; draft decisions 10 and 12.
  Acceptance criteria: RME detail adds exactly one audit row with `aksi='VIEW_RME'`; allergy create with item works; admin token returns 403; the confirmation row has today's date.
  QA scenarios: happy - add ALERGI_OBAT then `fn_cek_alergi` returns 1; failure - ALERGI_OBAT without item_id returns 422; unknown pasien returns 404 `ERR-RME-01`. Evidence `.omo/evidence/task-18-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add RME reading, allergy and red-flag endpoints`

- [ ] 19. Implement visit creation with TVP prescription and append-only note (25-26)
  What to do / Must NOT do: `POST /pasien/:id/kunjungan` body `{ reservasi_id?, layanan_id, tanggal_kunjungan?, keluhan, pemeriksaan_fisik, diagnosis, tindakan, catatan_bebas?, koreksi_dari_id?, resep: [{ item_id, jumlah, aturan_pakai }] }`; require a `RED_FLAG_CONFIRMED` audit row for this pasien, this bidan, and today (Asia/Jakarta) else 409 `ERR-RME-03`; call `sp_simpan_kunjungan` with a `sql.Table('tvp_resep')`; when `koreksi_dari_id` is present verify the referenced visit exists and belongs to the same patient (else 422 `ERR-VAL-01`); return `{ kunjungan_id, tagihan_id, total_tagihan }`. `PATCH /kunjungan/:id/catatan` body `{ catatan }` appends `\n[YYYY-MM-DD HH:mm WIB][<username>] <catatan>` to `catatan_bebas` without overwriting; 404 `ERR-RME-02` when missing. Do not pre-validate allergy or stock in TypeScript.
  Parallelization: Wave D | Blocked by: 6,9,10,16 | Blocks: 25,27
  References: user request endpoints 25-26; `TSD.md:54-57`; `TSD.md:140-141`; `TSD.md:210`; draft decisions 10-14.
  Acceptance criteria: a visit with 2 resep items creates a bill with 3 rincian (1 layanan + 2 items), decrements both stocks, and writes 2 PAKAI rows; without confirmation returns 409 RME-03; an allergic item returns 422 `ERR-RME-04`.
  QA scenarios: happy - full visit then `v_tagihan_detail` matches; failure - quantity above stock returns 409 `ERR-INV-02`; qty 0 returns 422 `ERR-VAL-01`. Evidence `.omo/evidence/task-19-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add visit creation with prescription and notes`

- [ ] 20. Implement RME PDF export (27)
  What to do / Must NOT do: `src/utils/pdf.ts` builds an A4 document with pdfkit: practice header, patient identity, active allergies/red flags, visit table (date, diagnosis, action, prescription), generated-at footer. `POST /pasien/:id/rme/export` sets `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="RME-<nama>-<date>.pdf"`, inserts `audit_logs` `aksi='DATA_EXPORTED'`, then pipes the document to `res` (no temp file). No billing data, no other patients.
  Parallelization: Wave D | Blocked by: 6,16,18 | Blocks: 26,27
  References: user request endpoint 27; `TSD.md:54`; `TSD.md:142`; `TSD.md:224`.
  Acceptance criteria: `curl -s -o /tmp/rme.pdf -w '%{content_type} %{http_code}'` returns `application/pdf 200`; `file /tmp/rme.pdf` reports PDF; the `DATA_EXPORTED` audit row exists; admin token returns 403.
  QA scenarios: happy - export the seeded patient; failure - unknown patient returns 404 `ERR-RME-01`; a patient with no visits still returns a valid PDF. Evidence `.omo/evidence/task-20-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add RME PDF export with audit trail`

- [ ] 21. Implement billing detail and list (28, 30)
  What to do / Must NOT do: `POST /kunjungan/:id/tagihan/detail` (ADMIN) reads `v_tagihan_detail` (rincian, payments, sisa) and returns 404 `ERR-FIN-01` when absent. `POST /tagihan/list` (ADMIN) filters status/date range/pasien/q plus pagination, newest first. BIDAN has no access.
  Parallelization: Wave E | Blocked by: 6,9 | Blocks: 22,23
  References: user request endpoints 28 and 30; `TSD.md:144-146`.
  Acceptance criteria: detail after todo 19 has `subtotal = qty * harga_satuan`; `status=LUNAS` returns only paid bills.
  QA scenarios: happy - detail matches DB sums; failure - unknown kunjungan returns 404 `ERR-FIN-01`. Evidence `.omo/evidence/task-21-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add billing detail and list endpoints`

- [ ] 22. Implement payment recording (29)
  What to do / Must NOT do: `POST /tagihan/:id/pembayaran` (ADMIN) body `{ jumlah, jalur }` with jalur in MANDIRI/BPJS/ASURANSI; calls `sp_catat_pembayaran` with `@dicatat_oleh` and `@ip`; returns updated totals/status; maps `ERR-FIN-02` on overpayment. Reject zero/negative.
  Parallelization: Wave E | Blocked by: 6,9,21 | Blocks: 23
  References: user request endpoint 29; `TSD.md:56`; `TSD.md:145`; `TSD.md:211`.
  Acceptance criteria: a partial payment keeps BELUM_LUNAS; paying the exact remainder sets LUNAS; overpay returns 409.
  QA scenarios: happy - two installments summing to total yield LUNAS; failure - paying total + 1 returns 409 `ERR-FIN-02`; `jumlah: 0` returns 422 `ERR-VAL-01`. Evidence `.omo/evidence/task-22-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add payment recording endpoint`

- [ ] 23. Implement finance recap (31)
  What to do / Must NOT do: `POST /keuangan/rekap/list` (ADMIN, BIDAN) body `{ dari, sampai, grup: 'HARIAN' | 'BULANAN' }` default HARIAN, maximum span 366 days, reading `v_rekap_pendapatan`; returns `{ periode, jumlah_transaksi, total_pendapatan }` rows plus `meta` totals. Inverted or out-of-range dates return 422 `ERR-RPT-01`.
  Parallelization: Wave E | Blocked by: 6,8,21 | Blocks: 27
  References: user request endpoint 31; `TSD.md:43`; `TSD.md:147`.
  Acceptance criteria: recap totals equal the sum of payments in the range; inverted range returns 422.
  QA scenarios: happy - pay then recap shows the amount; failure - `dari > sampai` returns 422 `ERR-RPT-01`. Evidence `.omo/evidence/task-23-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add finance recap endpoint`

- [x] 24. Implement inventory list, create and update (32-34)
  What to do / Must NOT do: `POST /inventaris/list` filters kategori/status_stok/q plus pagination from `v_inventaris_status`. `POST /inventaris` body `{ nama, kategori, satuan, stok, stok_minimum?, tgl_kedaluwarsa?, harga? }`; when `harga` is present insert an open ITEM price in `riwayat_harga`. `PATCH /inventaris/:id` body `{ nama?, satuan?, stok_minimum?, tgl_kedaluwarsa?, is_active?, harga? }`; `stok` is NOT patchable here. Soft delete via `is_active=false`. No hard delete.
  Parallelization: Wave E | Blocked by: 6,7 | Blocks: 25
  References: user request endpoints 32-34; `TSD.md:57`; `TSD.md:148-152`; `TSD.md:202`.
  Acceptance criteria: create with harga makes `fn_harga_berlaku('ITEM', id, today)` return it; patching stok is rejected; list status filter matches `fn_status_stok`.
  QA scenarios: happy - create an item with stock 0 shows status HABIS; failure - negative stock returns 422 `ERR-VAL-01`; unknown id returns 404 `ERR-INV-01`. Evidence `.omo/evidence/task-24-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add inventory list, create and update`

- [ ] 25. Implement restock and stock history (35-36)
  What to do / Must NOT do: `POST /inventaris/:id/restock` body `{ jumlah, harga_beli?, tgl_kedaluwarsa? }` calls `sp_restock_item` and returns the new stock. `POST /inventaris/:id/riwayat/list` filters jenis/date range plus pagination from `v_riwayat_stok_item`. No direct stock mutation.
  Parallelization: Wave E | Blocked by: 6,9,24 | Blocks: 26
  References: user request endpoints 35-36; `TSD.md:57`; `TSD.md:152-153`; `TSD.md:212`.
  Acceptance criteria: restock +10 raises stock by 10 and adds a RESTOCK row; the expiry update is visible in the list.
  QA scenarios: happy - restock then a visit deducts; failure - `jumlah: -1` returns 422 `ERR-VAL-01`; unknown item returns 404 `ERR-INV-01`. Evidence `.omo/evidence/task-25-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add restock and stock history endpoints`

- [ ] 26. Implement price list, change and history (37-39)
  What to do / Must NOT do: `POST /harga/list` (ADMIN, BIDAN) lists current prices from `v_harga_berlaku` with ref_tipe/q plus pagination. `PUT /harga/:ref_tipe/:ref_id` (ADMIN) body `{ harga, berlaku_dari, alasan }` calls `sp_ubah_harga`; `ref_tipe` must be ITEM or LAYANAN else 422 `ERR-VAL-02`. `POST /harga/:ref_tipe/:ref_id/riwayat/list` returns history ordered `berlaku_dari DESC`. Never update price rows in place.
  Parallelization: Wave E | Blocked by: 6,8,9 | Blocks: 27
  References: user request endpoints 37-39; `TSD.md:58`; `TSD.md:154-156`; `TSD.md:213`.
  Acceptance criteria: PUT creates a new open price and closes the previous at `berlaku_dari - 1 day`; history shows both; a duplicate open start returns 422 `ERR-PRC-01`.
  QA scenarios: happy - change a layanan price then a new visit uses the new snapshot; failure - `harga: -5` returns 422 `ERR-PRC-01`; invalid ref_tipe returns 422 `ERR-VAL-02`. Evidence `.omo/evidence/task-26-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add price list, change and history`

- [ ] 27. Implement analytics: summary, service trend and busiest hours (40-42)
  What to do / Must NOT do: `POST /laporan/ringkasan/list` body `{ dari, sampai }` returns kunjungan count, new patients, reservations, revenue, and unpaid bills from the views. `POST /laporan/tren-layanan/list` body `{ dari, sampai, grup: 'BULANAN' | 'HARIAN' }` returns per-period per-layanan counts plus top diagnoses grouped from `kunjungan.diagnosis`. `POST /laporan/jam-tersibuk/list` returns the last-30-day hour histogram from `v_jam_tersibuk` (24 buckets). Invalid ranges return 422 `ERR-RPT-01`. BIDAN only.
  Parallelization: Wave F | Blocked by: 6,8,23 | Blocks: 28
  References: user request endpoints 40-42; `TSD.md:59`; `TSD.md:157-160`.
  Acceptance criteria: summary totals match direct SQL for the seeded period; trend rows sorted descending; the histogram has 24 buckets.
  QA scenarios: happy - seed visits then the trend includes the layanan; failure - future `dari` returns 422 `ERR-RPT-01`; admin token returns 403. Evidence `.omo/evidence/task-27-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add analytics summary, trend and busiest hours`

- [ ] 28. Implement revenue comparison decomposition (43)
  What to do / Must NOT do: `POST /laporan/perbandingan/list` body `{ periode_a: { dari, sampai }, periode_b: { dari, sampai }, grup?: 'LAYANAN' }`. Per layanan compute V0/P0 (period A qty and average price) and V1/P1 (period B); return `volume_effect = (V1 - V0) * P0`, `price_effect = V0 * (P1 - P0)`, `interaction = (V1 - V0) * (P1 - P0)`, `delta = V1 * P1 - V0 * P0`, plus totals and `meta.formula`. Both ranges validated else 422 `ERR-RPT-01`. No stored procedure.
  Parallelization: Wave F | Blocked by: 6,8,27 | Blocks: 29
  References: user request endpoint 43; `TSD.md:59`; `TSD.md:161`.
  Acceptance criteria: qty-only change yields `price_effect = 0` and `interaction = 0`; price-only change yields `volume_effect = 0`; `delta = volume_effect + price_effect + interaction` within 0.01.
  QA scenarios: happy - assert the identity above; failure - missing/overlapping periods return 422 `ERR-RPT-01` or 422 `ERR-VAL-01`. Evidence `.omo/evidence/task-28-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add revenue decomposition comparison`

- [ ] 29. Implement report export PDF/Excel (44)
  What to do / Must NOT do: `POST /laporan/export` body `{ format: 'pdf' | 'excel', laporan: 'ringkasan' | 'tren-layanan' | 'jam-tersibuk' | 'perbandingan', dari, sampai }`. Excel via `exceljs` `writeBuffer()` with the xlsx MIME and `Content-Disposition: attachment; filename="laporan-<slug>-<date>.xlsx"`. PDF via pdfkit piped to `res` with a simple table. Reuse the todo 27-28 service queries. Invalid combinations return 422 `ERR-RPT-01`. No temp files.
  Parallelization: Wave F | Blocked by: 6,8,28 | Blocks: 37
  References: user request endpoint 44; `TSD.md:59`; `TSD.md:162`.
  Acceptance criteria: `curl -o /tmp/l.xlsx` returns the xlsx MIME and `file` reports Microsoft Excel; `curl -o /tmp/l.pdf` returns `application/pdf`; both non-empty.
  QA scenarios: happy - export each of the 4 reports; failure - `format: 'csv'` returns 422 `ERR-RPT-01`; admin token returns 403. Evidence `.omo/evidence/task-29-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add PDF and Excel report export`

- [ ] 30. Implement public content CRUD (45-48)
  What to do / Must NOT do: `POST /konten/list` (ADMIN) returns all rows including unpublished, filtered by tipe/is_published plus pagination. `POST /konten` body `{ tipe, judul, isi?, media_url?, urutan?, is_published? }`. `PATCH /konten/:id` partial. `DELETE /konten/:id` sets `is_published = 0` (soft); missing row returns 404 `ERR-CNT-01`. No hard delete. No admin fields on the public endpoint.
  Parallelization: Wave F | Blocked by: 6,7 | Blocks: 31,32
  References: user request endpoints 45-48; `TSD.md:164-167`; `TSD.md:202`.
  Acceptance criteria: delete leaves the row with `is_published = 0` and removes it from `/public/konten/list`; the audit trigger records the UPDATE.
  QA scenarios: happy - create then publish then see it publicly; failure - patch unknown id returns 404 `ERR-CNT-01`; invalid `tipe` returns 422. Evidence `.omo/evidence/task-30-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add public content CRUD with soft delete`

- [ ] 31. Implement notification log list and resend (49-50)
  What to do / Must NOT do: `POST /notifikasi/log/list` (ADMIN) filters jenis/status/date plus pagination, newest first. `POST /notifikasi/:id/kirim-ulang` (ADMIN): when `retry_count >= 3` return 502 `ERR-NTF-01`; otherwise retry through `wa.ts`, increment `retry_count`, set status TERKIRIM/GAGAL and `waktu_kirim`, return the row. Allow resend only for CONFIRMATION, PENGINGAT_H1, PERUBAHAN, INVENTARIS; OTP rows return 422 `ERR-NTF-01` (documented).
  Parallelization: Wave F | Blocked by: 6,7 | Blocks: 32
  References: user request endpoints 49-50; `TSD.md:60`; `TSD.md:168-169`; `TSD.md:230-231`.
  Acceptance criteria: an unreachable WA URL leaves status GAGAL and increments retry; the 4th attempt returns 502.
  QA scenarios: happy - a seeded GAGAL row with retry 0 becomes TERKIRIM with a stub WA; failure - unknown id returns 404 `ERR-NTF-01`; OTP row returns 422. Evidence `.omo/evidence/task-31-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add notification log and resend`

- [ ] 32. Implement audit log search (51)
  What to do / Must NOT do: `POST /audit-logs/list` (BIDAN only) filters `user_id`, `aksi`, `entitas`, `entitas_id`, and date range plus pagination from `v_audit_log_detail`, ordered `created_at DESC`. Return `nilai_lama`/`nilai_baru` parsed into JSON objects when present. ADMIN must get 403. No writes.
  Parallelization: Wave F | Blocked by: 6,8 | Blocks: 37
  References: user request endpoint 51; `TSD.md:61`; `TSD.md:170`; `TSD.md:224-226`.
  Acceptance criteria: after a visit, the audit list as bidan shows INSERT rows for kunjungan and tagihan; admin token returns 403.
  QA scenarios: happy - filter `aksi=VIEW_RME` shows the RME open; failure - invalid date range returns 422; admin returns 403 `ERR-AUTH-03`. Evidence `.omo/evidence/task-32-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add audit log search`

- [ ] 33. Implement cron jobs and wire startup
  What to do / Must NOT do: `src/jobs/reminderH1.job.ts` schedules `env.CRON_REMINDER_H1` with `{ timezone: 'Asia/Jakarta' }`: find tomorrow's MENUNGGU reservations without a PENGINGAT_H1 log today, insert log_notifikasi ANTRE, send WA, update TERKIRIM/GAGAL. `src/jobs/inventoryWeekly.job.ts` schedules `env.CRON_INVENTORY_WEEKLY`: build one summary of items with `fn_status_stok` in HABIS/MENIPIS/KEDALUWARSA, send it to the ADMIN phone, insert one INVENTARIS log row. `src/jobs/index.ts` registers both only when `NODE_ENV !== 'test'`, logs schedules, and catches errors so a job never crashes the process. No third job.
  Parallelization: Wave G | Blocked by: 6,7,30,31 | Blocks: 38
  References: user request Bagian 1.5; `TSD.md:229-231`; `TSD.md:60`.
  Acceptance criteria: `cron.validate` accepts both expressions; starting the server logs both schedules with Asia/Jakarta; calling each job function directly inserts the expected rows.
  QA scenarios: happy - call `runReminderH1()` with a seeded tomorrow reservation and get one log row; failure - WA down leaves the row GAGAL and the process alive. Evidence `.omo/evidence/task-33-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(backend): add reminder and inventory cron jobs`

- [ ] 34. Build the Postman generator and emit both JSON files
  What to do / Must NOT do: `backend/docs/postman/generate-postman.mjs` (ESM) holds a spec array of all 51 requests (folder, name, method, path, roles, body example, error codes, saved variables) and writes `Praktik_Mandiri_Bidan_API.postman_collection.json` (schema v2.1.0) plus `Local_Dev.postman_environment.json`. Exactly 11 folders in this order: 1. Auth, 2. Public, 3. Pendaftaran & Antrean, 4. RME & Keselamatan Pasien, 5. Keuangan & Tagihan, 6. Inventaris, 7. Harga, 8. Laporan Analitik, 9. Konten Publik, 10. Notifikasi, 11. Audit Logs. Every request has a description (allowed roles, FSD reference, possible error codes), a valid JSON body example, `Authorization: Bearer {{token}}` on protected routes, and URL `{{baseUrl}}/api/v1/...`. Test scripts save: login token + user_id, patient create pasien_id, session create sesi_id, reservation reservasi_id, visit kunjungan_id + tagihan_id, inventory create item_id (via `pm.environment.set`). Generate then commit; never hand-write the JSON. No extra requests.
  Parallelization: Wave G | Blocked by: 6,12-32 | Blocks: 37
  References: user request Bagian 1.6; endpoint inventory above; `TSD.md:110-170`.
  Acceptance criteria: `node backend/docs/postman/generate-postman.mjs` exits 0; generated JSON parses; recursive request count = 51; folder count = 11; `Bearer {{token}}` appears on all protected requests; the environment has baseUrl, token, and the 6 saved IDs plus credentials.
  QA scenarios: happy - a node walk asserts 51 requests, 11 folders, every request has a description; failure - remove one spec entry and confirm the count assertion fails, then restore. Evidence `.omo/evidence/task-34-praktik-bidan-monorepo.txt`
  Commit: Y | `docs(api): generate Postman collection and environment`

- [ ] 35. Scaffold `frontend/` with Vite 5.4 + React 18.3 + TypeScript and Tailwind v3
  What to do / Must NOT do: create the Vite react-ts structure manually. `package.json`: react 18.3.1, react-dom 18.3.1, vite ^5.4.0, @vitejs/plugin-react ^4.3.0, typescript ^5.6.0, @types/react 18.3.x, @types/react-dom 18.3.x, @types/node ^22, tailwindcss ^3.4.0, postcss ^8.4.0, autoprefixer ^10.4.0, tailwindcss-animate, class-variance-authority, clsx, tailwind-merge, lucide-react, @radix-ui/react-slot, @radix-ui/react-label, react-router-dom ^6, axios ^1, recharts ^2. Also `index.html`, `vite.config.ts` (react plugin + alias `@` via `fileURLToPath(new URL('./src', import.meta.url))`), `tsconfig.json` (references to app/node, `files: []`), `tsconfig.app.json` (baseUrl/paths, strict, `jsx: react-jsx`, `composite: true`, `tsBuildInfoFile` under `node_modules/.tmp`), `tsconfig.node.json` (`composite: true`, includes `vite.config.ts`), `postcss.config.js` (ESM export, tailwindcss + autoprefixer), `tailwind.config.js` (ESM export, content index.html + src, darkMode class, shadcn tokens, borderRadius, tailwindcss-animate), `.env.example` (`VITE_API_BASE_URL=http://localhost:3000/api/v1`), `src/vite-env.d.ts`, `src/main.tsx`, and `src/index.css` with the shadcn HSL `:root`/`.dark` variables, the three Tailwind directives, and base border/body rules. Scripts: `dev: vite`, `build: tsc -b && vite build`, `typecheck: tsc -p tsconfig.app.json --noEmit`, `preview: vite preview`. No routes, pages, API clients, or charts.
  Parallelization: Wave G | Blocked by: 1 | Blocks: 36
  References: user request Bagian 2.1-2.2; `TSD.md:77`; draft decision 15.
  Acceptance criteria: `cd frontend && npm install && npm run typecheck` exits 0 (root `npx tsc --noEmit` also exits 0); `npm run build` exits 0 and creates `dist/index.html`; the installed tailwind binary reports v3.
  QA scenarios: happy - build output exists; failure - importing `@/lib/utils` before todo 36 fails typecheck, proving the alias is wired. Evidence `.omo/evidence/task-35-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(frontend): scaffold Vite React TypeScript with Tailwind`

- [ ] 36. Add shadcn/ui config, `cn` util, five components and typed starter App
  What to do / Must NOT do: `components.json` with `$schema`, style `new-york`, `rsc: false`, `tsx: true`, tailwind config `tailwind.config.js`, css `src/index.css`, baseColor `slate`, cssVariables true, and aliases components/utils/ui/lib/hooks. `src/lib/utils.ts` exports `cn(...inputs)` from clsx + twMerge. Create `src/components/ui/button.tsx` (cva variants default/secondary/outline/ghost/destructive + sizes, `asChild` via Radix Slot), `card.tsx` (Card/Header/Title/Description/Content/Footer), `input.tsx`, `label.tsx` (Radix Label), `badge.tsx` (cva variants). `src/App.tsx` is a typed starter: centered clean layout, project title "Sistem Digitalisasi Praktik Mandiri Bidan", subtitle "Praktik Mandiri Bdn. Ria Indrasti J., S.Keb", one Card with a short description, an Input + Label (placeholder only, no handlers required), a Badge, and a Button - all from `@/components/ui/*`. No state, no data fetching, no router.
  Parallelization: Wave G | Blocked by: 35 | Blocks: 39
  References: user request Bagian 2.3-2.4; shadcn `components.json` schema; `TSD.md:77`.
  Acceptance criteria: `cd frontend && npm run typecheck` exits 0; `npm run build` exits 0; `src/App.tsx` imports all five components; `grep -c "@/" src/App.tsx` >= 4.
  QA scenarios: happy - build and preview show the card and button; failure - temporarily pass an invalid Button variant and confirm typecheck fails, then revert. Evidence `.omo/evidence/task-36-praktik-bidan-monorepo.txt`
  Commit: Y | `feat(frontend): add shadcn components and starter screen`

- [ ] 37. Write the root `README.md` (local run, migration order, Postman, production notes)
  What to do / Must NOT do: sections: Prerequisites (Node 22; SQL Server 2025 already installed locally with `sqlcmd`; SSMS optional; no Docker required), Development (start the local SQL Server service; `cp backend/.env.example backend/.env` and fill `DB_PASSWORD`; run `01`-`05` in order via the documented `sqlcmd` command; `cd backend && npm install && npm run dev`; `cd frontend && npm install && npm run dev`), Seed credentials (`bidan`/`Bidan#2026`, `admin`/`Admin#2026`, change in production), Postman import (collection + environment, set baseUrl, login), Production deployment (Vercel: build command `npm run build`, output `dist`, env `VITE_API_BASE_URL`; backend: PM2 + IIS/nginx reverse proxy, HTTPS, `CORS_ORIGINS` allowlist, `trust proxy`, native SQL Server with daily full + 30-minute log backups), Troubleshooting (instance not listening on 1433 or wrong port; mixed-mode auth disabled; `sqlcmd -C` needed for the self-signed dev certificate; bcrypt native build note; port 1433 exposure warning). Keep commands copy-pasteable and consistent with the actual scripts.
  Parallelization: Wave H | Blocked by: 33,34 | Blocks: 39
  References: user request "ringkasan cara menjalankan"; `TSD.md:64-66`; `TSD.md:72-80`; draft decisions 19-20 and 22.
  Acceptance criteria: every command in the README exists in the corresponding `package.json` or is a real `sqlcmd`/`npm` invocation; a dry read confirms the five SQL files are listed in order; credentials match `05_seed.sql`; no Docker command appears.
  QA scenarios: happy - follow the README on a clean checkout in order; failure - run SQL files out of order and confirm the README's documented failure is what occurs, then restore. Evidence `.omo/evidence/task-37-praktik-bidan-monorepo.txt`
  Commit: Y | `docs(root): add setup, migration, Postman and deployment guide`

- [ ] 38. Run the dev database migration and end-to-end API smoke
  What to do / Must NOT do: confirm the already-installed local SQL Server 2025 is reachable with `sqlcmd -C -S "$DB_HOST,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -Q "SELECT @@VERSION"` (expect a 16.x/17.x banner and no login/port error); execute `01`-`05` in order with the documented sqlcmd invocation; verify 18 tables, 4 functions, 14 views, 6 procedures, 15 audit triggers + 1 immutable. Start the backend against the local instance, then run the smoke chain with curl: login bidan -> token; `POST /public/layanan/list` with meta; `POST /public/reservasi` for a new patient; `POST /pasien/walk-in` as admin; RME detail as bidan (audit VIEW_RME); red-flag confirmation; `POST /pasien/:id/kunjungan` with one resep item; `POST /kunjungan/:id/tagihan/detail`; `POST /tagihan/:id/pembayaran` for the full amount -> LUNAS; `POST /audit-logs/list` shows the mutations. Capture every request/response and DB counts. If the instance is unreachable (service stopped, wrong port, mixed-mode auth off, wrong password), record the exact `sqlcmd` error and fall back to static review without claiming execution.
  Parallelization: Wave H | Blocked by: 7-11,33 | Blocks: 39
  References: `TSD.md:174-214`; seed data; verification strategy above.
  Acceptance criteria: the script logs `18/4/14/6/16` object counts; the smoke chain returns the documented statuses (201/200) and the bill ends LUNAS; audit rows exist for the visit and export.
  QA scenarios: happy - full chain above; failure - attempt a quota overrun and an overpayment and confirm 409 codes, then continue. Evidence `.omo/evidence/task-38-praktik-bidan-monorepo.txt` plus `.omo/evidence/task-38-smoke.json`
  Commit: Y | `test(e2e): verify migration and core API flows against dev database`

- [ ] 39. Final install, typecheck, build and route audit for both apps
  What to do / Must NOT do: `cd backend && npm install && npx tsc --noEmit && npm run build && npm run audit:routes`; `cd frontend && npm install && npm run typecheck && npx tsc --noEmit && npm run build`. Confirm `backend/dist` exists, `frontend/dist/index.html` exists, the audit prints 51 routes and zero GET, and no `.env` file is committed. Do not modify code in this todo except fixing build/type errors surfaced here.
  Parallelization: Wave H | Blocked by: 35,36,37,38 | Blocks: F1-F4
  References: user request "VERIFIKASI AKHIR"; todo 6 audit script; todo 2/35 scripts.
  Acceptance criteria: all commands exit 0; audit output contains exactly 51 lines and no `GET`; both `dist` artifacts exist.
  QA scenarios: happy - clean install from lockfiles then all four checks pass; failure - introduce a deliberate type error in a scratch file and confirm `tsc --noEmit` fails, then remove it. Evidence `.omo/evidence/task-39-praktik-bidan-monorepo.txt`
  Commit: Y | `chore: verify installs, typechecks and builds`

## Final verification wave

> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.

- [ ] F1. Plan compliance audit
  Verify every one of the 51 endpoints exists with the exact method/path/role, the envelope and error catalogue match, all 18 tables/functions/views/procedures/triggers exist, cron schedules match env, and no Must-NOT-Have item exists (especially zero GET, zero ORM, zero frontend pages). Command set: `npm run audit:routes`, SQL object counts, grep for forbidden patterns. Evidence `.omo/evidence/F1-praktik-bidan-monorepo.txt`.
- [ ] F2. Code quality review
  Review the backend for layering violations (controllers thin, services own logic, repositories own SQL), parameterized queries everywhere, no `SELECT *`, typed error mapping, no leaked secrets, `strict` types with no `any` escape hatches, and correct connection release. Evidence `.omo/evidence/F2-praktik-bidan-monorepo.txt`.
- [ ] F3. Real manual QA
  Execute the full smoke chain from todo 38 against the local SQL Server 2025 instance (or record the exact connection failure and the static fallback), plus boot-without-DB envelope check, malformed JSON, 401/403/422/423/429 paths, PDF/XLSX downloads and Postman JSON validation. Evidence `.omo/evidence/F3-praktik-bidan-monorepo.txt`.
- [ ] F4. Scope fidelity
  Diff the delivered tree against the Scope file inventory: every file present, no extra business feature, no frontend router usage, no test framework, no Dockerfile or `docker-compose.yml`, README accurate. Evidence `.omo/evidence/F4-praktik-bidan-monorepo.txt`.

## Commit strategy

One commit per todo, conventional commits as listed. Grouping is not allowed because each todo is independently verifiable; the final todo 39 and the verification wave produce no additional product commits. Do not commit `.env`, `node_modules`, `dist`, or `.DS_Store`. The worktree must be clean after todo 39.

## Success criteria

- `backend`: `npm install`, `npx tsc --noEmit`, `npm run build`, `npm run audit:routes` (51 routes, 0 GET) all pass.
- `frontend`: `npm install`, `npm run typecheck`, `npx tsc --noEmit`, `npm run build` pass and `dist/index.html` exists.
- All five SQL scripts execute in order on the already-installed local SQL Server 2025 instance (or the exact connection failure is documented with the static fallback), creating 18 tables, 4 functions, 14 views, 6 procedures, 15 audit triggers + 1 immutability trigger.
- Every one of the 51 endpoints is reachable with the documented role and returns the typed success/error envelope; reads use POST only.
- Postman collection has 51 requests in 11 folders, valid schema v2.1, Bearer auth on protected routes, and variable-saving test scripts.
- README lets a new developer run the stack, import Postman, and understand the production topology (Vercel + PM2/IIS + native SQL Server).