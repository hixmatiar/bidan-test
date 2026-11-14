# Assignment: plan checkbox 24

Repo: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan. Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read
Plan checkbox 24; endpoints 32-34; `backend/src/{modules,routes/inventaris.routes.ts,middlewares}`; `TSD.md:57,148-152,202`; `01_schema.sql` item_inventaris + riwayat_harga CHECKs.

## Implement exactly checkbox 24
Create `backend/src/modules/inventaris/` (validators, repository, service, controller); replace the list/create/update stubs in `backend/src/routes/inventaris.routes.ts`.
- `POST /inventaris/list` (BIDAN, ADMIN) — filters kategori/status_stok/q + pagination from `v_inventaris_status`; status_stok must be HABIS/KEDALUWARSA/MENIPIS/AMAN via `fn_status_stok`.
- `POST /inventaris` — `{nama, kategori, satuan, stok, stok_minimum?, tgl_kedaluwarsa?, harga?}`; insert an open ITEM price row when harga present (same transaction); negative/zero-invalid values → 422 ERR-VAL-01.
- `PATCH /inventaris/:id` — `{nama?, satuan?, stok_minimum?, tgl_kedaluwarsa?, is_active?, harga?}`; `stok` NOT patchable (422 if present); `harga` inserts a new open price and closes the previous at DAY-1; soft delete via is_active=false; unknown 404 ERR-INV-01.
No hard delete; no restock/history endpoints (tasks 25).

Constraints: no other modules, no schema changes, no plan/.omo edits. CommonJS, strict TS, parameterized SQL, transactions where multi-row.

## Verify
1. `npx tsc --noEmit && npm run build && npm run audit:routes`.
2. Live port 4124: create item with stock 0 + harga → list shows status HABIS; `fn_harga_berlaku('ITEM', id, today)` returns the price; patch with `stok` → 422; negative stock → 422; unknown id → 404.
3. Clean up scratch item/price rows (delete price then item) so seed counts stay 10 items.
4. Confirm audit rows exist for the created item (and note audit rows are append-only; they remain, which is acceptable — record it).

## Record/commit
Append to `.omo/evidence/task-24-praktik-bidan-monorepo.txt`; commit `feat(backend): add inventory list, create and update`. Print `DONE_TASK_24` + DoneClaim.