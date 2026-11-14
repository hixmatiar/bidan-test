---
slug: praktik-bidan-monorepo
status: plan-written
intent: clear
review_required: false
pending-action: user chooses start-work or high-accuracy review
approach: Greenfield monorepo: full layered Express+TypeScript backend (CommonJS, per-request mssql connection with SESSION_CONTEXT) + 5 SQL Server scripts (18 tables, 4 functions, 14 views, 6 procs, 16 triggers, seed) + all 51 POST/PATCH/PUT/DELETE endpoints + 2 cron jobs + generated Postman v2.1 collection/env, plus init-only Vite+React+TS+Tailwind v3+shadcn frontend, targeting the already-installed local SQL Server 2025 instance (no container), and static-or-real SQL verification.
---

# Draft: praktik-bidan-monorepo

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

| id | outcome | status | evidence path |
| --- | --- | --- | --- |
| backend-core | Express app boots: env config, ApiResponse/AppError helpers, JWT auth + role + zod + session-context + rate-limit middleware, mssql pool util | active | backend/src/app.ts (to create) |
| backend-sql | 5 executable SSMS scripts: 18 tables + filtered unique index, 4 fn, 14 views, TVP + 6 procs, 16 triggers, seed with bcrypt cost 12 | active | backend/database/ (to create) |
| backend-auth-public | Endpoints 1-10: login/logout/refresh/OTP reset, public konten/layanan/sesi/pasien-cek/reservasi | active | backend/src/routes/auth.routes.ts, public.routes.ts |
| backend-clinic | Endpoints 11-27: pasien, walk-in, reservasi/antrean/sesi, status, RME, alergi, red-flag, kunjungan (TVP), catatan, export PDF | active | backend/src/routes/ (to create) |
| backend-finance | Endpoints 28-31: tagihan detail, pembayaran, tagihan list, rekap keuangan | active | backend/src/routes/tagihan.routes.ts, keuangan.routes.ts |
| backend-inventory | Endpoints 32-39: inventaris CRUD/restock/riwayat, harga list/PUT/riwayat | active | backend/src/routes/inventaris.routes.ts, harga.routes.ts |
| backend-analytics-ops | Endpoints 40-51: 5 laporan + konten CRUD + notifikasi log/retry + audit logs, 2 cron jobs | active | backend/src/routes/laporan.routes.ts, konten.routes.ts, notifikasi.routes.ts, audit.routes.ts, jobs/ |
| postman-docs | Postman Collection v2.1 (51 requests, 11 folders, test scripts) + environment + generator script | active | backend/docs/postman/ |
| dev-infra | none (dropped): SQL Server 2025 is already installed natively, so there is no compose/Docker deliverable; README documents the local instance | dropped | - |
| frontend-init | Vite React TS starter with Tailwind v3 + shadcn (button/card/input/label/badge) compiling clean | active | frontend/src/App.tsx (to create) |

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->

| assumption | adopted default | rationale | reversible? |
| --- | --- | --- | --- |
| Module system (TSD allows NodeNext or CommonJS) | CommonJS + `moduleResolution: node` + `tsc-alias` for `@/*` at build, `tsx` for dev | NodeNext ESM forces `.js` import suffixes + complicates path aliases; CJS is the lowest-friction consistent setup | yes |
| DB session context | middleware acquires ONE pooled connection per protected request, sets user_id/ip via `sp_set_session_context`, exposes it on `res.locals.db`, releases on response finish; all repos in that request use that connection | SESSION_CONTEXT is connection-scoped; a fresh pooled request would lose the context, breaking triggers | yes |
| 15 audit triggers vs 17 business tables | triggers on users, pasien, sesi_praktik, layanan, reservasi, kunjungan, resep_item, alergi_kondisi, item_inventaris, riwayat_stok, riwayat_harga, tagihan, tagihan_rincian, pembayaran, konten_publik; otp_reset (secret hashes), log_notifikasi (is itself a log) and audit_logs (append-only trigger) excluded | TSD says 15; excluding secret material and log-of-log tables is the defensible 15 | yes |
| Tagihan composition in `sp_simpan_kunjungan` | rincian = 1 x layanan (harga via `fn_harga_berlaku`) + each resep item qty (harga ITEM via `fn_harga_berlaku`), stock deducted as riwayat_stok PAKAI | TSD requires TVP resep + tagihan; items have prices only in riwayat_harga so the procedure must resolve them | yes |
| Auth refresh semantics | `POST /auth/refresh` requires a still-valid access token and issues a fresh 30-minute token with the same claims (no separate refresh-token table, since none exists in the 18 tables) | TSD lists refresh as JWT-protected and defines no refresh token table | yes |
| Password seed | `bidan` / `Bidan#2026` (role BIDAN) and `admin` / `Admin#2026` (role ADMIN), bcrypt cost 12, documented in README with change-in-production warning | user-approved | yes |
| TSD source | user converts `2026Ganjil_B_01_TSD.pdf` to text; plan must be reconciled against it before finalization | user chose to provide text | n/a |
| Tailwind version | Tailwind CSS v3.4 + postcss + autoprefixer (exactly as requested); not v4 | request names postcss/autoprefixer/tailwind.config, which is the v3 setup; shadcn supports v3 | yes |
| Frontend deps | manual shadcn component files (no network-dependent CLI registry fetch) using cva + clsx + tailwind-merge + radix slot/label + lucide-react | reproducible/offline; `shadcn init` registry access is an avoidable failure point | yes |
| Postman artifacts | one generator script (`backend/docs/postman/generate-postman.mjs`) emits both JSON files, committed alongside | 51 requests with descriptions/test scripts stay consistent; hand-writing 51 request objects is error-prone | yes |
| DB verification | the already-installed local SQL Server 2025 instance (`DB_HOST`/`DB_PORT`/`DB_PASSWORD` from `backend/.env`) for real migration + e2e attempt; if the instance is unreachable (service down, wrong port, mixed-mode auth off), fall back to static SQL review with the exact `sqlcmd` failure logged | user confirmed SQL Server 2025 is already installed; real execution against the real target is the best evidence, and no second engine is introduced | yes |
| Root layout | no npm workspaces: `backend/` and `frontend/` install independently, plus root README/.gitignore | verification spec says run npm install in each folder; avoids hoisting surprises with native bcrypt | yes |

## Findings (cited - path:lines)

- Working dir `/Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan` contains only `.codegraph/` — greenfield, no existing conventions to reuse (glob `**/*`).
- TSD text now available at `TSD.md` (231 lines), converted by the user from `2026Ganjil_B_01_TSD.pdf`. It matches the request and adds the rules below.
- `TSD.md:54` — RME is append-only: corrections must link to the original via `koreksi_dari_id`, never overwrite old data.
- `TSD.md:55,225` — Red-Flag: banner + mandatory read-confirmation checkbox before filling the examination form; `ERR-AUTH-03` blocks ADMIN from all RME and audit-log endpoints.
- `TSD.md:57,210` — stock deduction happens on prescribing, negative stock prevented by row locking; `sp_simpan_kunjungan` also validates the prescription against allergies via `fn_cek_alergi`.
- `TSD.md:58` — price history is append-only: close old `berlaku_sampai`, insert new row with reason.
- `TSD.md:209` — `sp_reschedule_reservasi` must also re-sequence queue numbers in the ORIGIN session, not only move one row.
- `TSD.md:52,227` — public testimonial names use initials only; public endpoints expose no medical data (UU PDP); 10 req/min/IP.
- `TSD.md:64` — search history P95 <= 2s and clinical/financial transactions <= 800ms (informs indexes; not runtime-verifiable without DB).
- `TSD.md:77` — TSD frontend stack also lists react-router-dom 6.x, axios 1.x, recharts 2.x (installed, unused in init-only scope).
- `TSD.md:214` — exactly 16 triggers = 15 business `AFTER INSERT, UPDATE, DELETE` + 1 `INSTEAD OF` immutability trigger.
- `Template FSD-TSD RSI.docx` at `Documents/UNS/SEM 3/RSI/` is an empty template, not the filled spec.
- `/Users/pikachen/.cache/.../ulw-plan/scripts/scaffold-plan.mjs` defines the exact plan skeleton/section order replicated below (no shell tool available in this session to run it).

## Decisions (with rationale)

1. **CommonJS, not NodeNext** — TSD permits both; CJS keeps `@/*` aliasing trivial (tsc-alias) and avoids ESM extension churn.
2. **Per-request connection** — audit triggers read `SESSION_CONTEXT`; mssql pools connections, so session context must be set and consumed on the same connection.
3. **Typed envelopes** — `ApiResponse<T>` discriminated union (`success`/`error`) + central `AppError` code→HTTP map so every controller returns one shape.
4. **Reads via POST** — no `GET` route is registered at all; collection reads end `/list` (meta required, per_page default 15 max 100), single reads end `/detail`.
5. **Exactly 51 route registrations** — a route inventory test/audit counts them; no health/docs endpoints added.
6. **SQL procs own transactional invariants** — antrean allocation (`UPDLOCK/HOLDLOCK`), reschedule/cancel, visit+resep+stock+billing, payment, restock, price change; services only call them and map errors.
7. **15 audit triggers + 1 immutability trigger** — the exact table list above; trigger bodies use `SESSION_CONTEXT(N'user_id')`, `SESSION_CONTEXT(N'ip')`, `FOR JSON PATH, WITHOUT_ARRAY_WRAPPER`.
8. **Cron** — `node-cron` with `{ timezone: 'Asia/Jakarta' }`, schedules read from env (`CRON_REMINDER_H1`, `CRON_INVENTORY_WEEKLY`).
9. **PDF/Excel** — pdfkit streams to `res` (no temp files); exceljs writes to a Buffer via `workbook.xlsx.writeBuffer()`.
10. **Red-Flag confirmation gate** — no dedicated table exists, so endpoint 24 writes an `audit_logs` row (`aksi='RED_FLAG_CONFIRMED'`, `entitas='pasien'`, `entitas_id=:id`, `user_ref`=bidan username); endpoint 25 refuses with `ERR-RME-03` unless a confirmation by the same BIDAN exists for that pasien on the current Asia/Jakarta date. The frontend interval between confirm and visit is thus enforced server-side.
11. **RME append-only enforcement** — no UPDATE/DELETE of clinical text: `POST /pasien/:id/kunjungan` always inserts; `PATCH /kunjungan/:id/catatan` appends `[YYYY-MM-DD HH:mm WIB][<username>] <text>` to `catatan_bebas`; corrections are new `kunjungan` rows with `koreksi_dari_id` set (optional body field on endpoint 25).
12. **Public privacy** — `/public/pasien/cek` accepts `nik` OR `no_telepon`, returns only `{ terdaftar, pasien_id, nama_samaran, has_red_flag }` where `nama_samaran` = first name + initials (e.g. "R*** A***"); `/public/konten/list` returns TESTIMONI `judul/isi` already stored with initials; no diagnosis/visit data on any public route.
13. **Reschedule renumbering** — `sp_reschedule_reservasi` (same session) cancels the row, renumbers remaining active rows 1..N ordered by old `nomor_antrean` in one UPDATE, recomputes `estimasi_jam` via `fn_hitung_estimasi_jam`, then for a move inserts a new row in the target session via the same allocation logic; `@sesi_baru = NULL` means cancel-only.
14. **Allergy validation inside SQL** — `sp_simpan_kunjungan` tests each TVP row: `fn_cek_alergi(pasien_id, item_id) = 1` raises `RAISERROR` with a recognizable token; service maps it to `ERR-RME-04` (422). Service never pre-checks (single source of truth, no race).
15. **Frontend TSD parity without pages** — install `react-router-dom`, `axios`, `recharts` alongside Tailwind/shadcn so `package.json` matches TSD §3, but create no routes, no data fetching, no charts.
16. **DB_APP_USER hardening** — `01_schema.sql` ends with an idempotent, commented-by-default block that creates `DB_APP_USER` (no login) and grants `SELECT/INSERT/UPDATE/DELETE/EXECUTE` while `DENY UPDATE, DELETE ON dbo.audit_logs`; README explains DBA must map the login. Keeps the script runnable by a non-sysadmin.
17. **Error-code HTTP mapping** — AUTH-01/02/04 401, AUTH-03 403, AUTH-05/LOCK-01 423, RSV-01/02/04 409, RSV-03/RME-01/RME-02/INV-01/FIN-01/CNT-01 404, RSV-05/RME-03/RME-04/INV-02/INV-03/FIN-02/PRC-01/RPT-01/VAL-01..03 422, VAL-04 400, NTF-01/SYS-03 502/503, SYS-01/SYS-02 500. Exact table goes in the plan and in `src/utils/errors.ts`.
18. **Zero GET routes** — express router registration review is an acceptance criterion; only POST/PATCH/PUT/DELETE are mounted. Static SPA hosting is out of scope (IIS handles it per TSD §3).
19. **~~Docker Compose is development-only, db-only~~ SUPERSEDED by decision 22** — the original plan spun a `db` container; the user then confirmed SQL Server 2025 is already installed locally, so the container deliverable is dropped entirely.
20. **Deployment-readiness in code, not extra files** — `app.set('trust proxy', 1)` (real IP behind IIS/nginx for rate limiting), CORS origin allowlist from `CORS_ORIGINS` env (never `*` in production), secrets only via env, pool sizing from env with sane defaults. Vercel needs only `VITE_API_BASE_URL`.
21. **Verification upgrade** — the worker attempts real migration of `01`-`05` against the local instance plus end-to-end smoke (login → public list → reservasi → kunjungan → tagihan → pembayaran). If the instance cannot be reached, it records the exact `sqlcmd` failure as evidence and falls back to static SQL review; the plan must not claim DB execution without a captured log.
22. **Dev target is the existing native SQL Server 2025, not a container** — no `docker-compose.yml`, no Dockerfile, no install step. `backend/.env.example` ships `DB_PASSWORD=CHANGE_ME`; the developer fills the real password only in the gitignored `backend/.env`. `README.md` documents service startup, mixed-mode auth, port (default 1433, overridable via `DB_PORT`), and the `sqlcmd -C` invocation for the self-signed dev certificate. Dev and production now share the same engine family, which removes the container/emulation risk entirely.

## Scope IN

- `backend/`: package.json, tsconfig.json, `.env.example`, `src/{app,server}.ts`, config, types, utils, middlewares, validators, routes, controllers, services, repositories, jobs; `database/01_schema.sql` … `05_seed.sql`; `docs/postman/` collection + environment + generator.
- Root `README.md` (local run: start local SQL Server 2025 → migration → backend → frontend; production notes: Vercel env, PM2/IIS, CORS allowlist, backups) + `.gitignore`. No compose file.
- `frontend/`: Vite react-ts scaffold, Tailwind v3 + postcss/autoprefixer, shadcn config + 5 components, typed starter `App.tsx`.
- Verification: `npm install` both apps, `npx tsc --noEmit` both, backend `npm run build`, frontend `npm run build`, backend boot + public endpoint envelope smoke test, route count audit, SQL static review, and — when the local instance is reachable — real migration + end-to-end API smoke.

## Scope OUT (Must NOT have)

- No GET endpoints anywhere (TSD 3.1 forbids them), no OpenAPI/Swagger, no ORM, no Dockerfile or `docker-compose.yml`, no auth refresh-token table, no frontend business pages/router/state library, no test framework beyond minimal runnable smoke checks, no CI config, no ESLint/Prettier setup.
- No extra database tables/columns beyond the 18 specified; no extra endpoints beyond the 51.

## Open questions

- None blocking. Test strategy default: minimal agent-executed smoke checks (no test framework) — confirmed at the approval gate unless vetoed.

## Approval gate
status: approved
approved-by: user ("lanjut")
plan: .omo/plans/praktik-bidan-monorepo.md (39 implementation todos + F1-F4)
next-workflow-action: user chose "Start work"; execute in a worker session via $start-work praktik-bidan-monorepo (planning session never implements). Dev DB correction (2026-11-13): the user already has SQL Server 2025 installed, so the plan now targets that local instance and drops compose (decision 22).
metis-note: metis subagent was unavailable (ECONNREFUSED); gap analysis performed in-session against TSD.md and folded into the plan (password-hash exclusion in audit trigger, two-phase queue renumbering, duplicate TVP aggregation, env values, route-audit placement, Tailwind/tsc build details).

