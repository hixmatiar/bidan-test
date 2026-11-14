# Assignment: plan checkbox 26

Repo: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan. Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read
Plan checkbox 26; endpoint rows 37-39; `backend/src/routes/harga.routes.ts`; `backend/src/modules/inventaris/*` (pattern to copy); `TSD.md:58,154-156,213`; `03_stored_procedures.sql` sp_ubah_harga.

## Implement exactly checkbox 26
Create `backend/src/modules/harga/` (validators, repository, service, controller); replace the 3 stubs in `backend/src/routes/harga.routes.ts`.
- `POST /harga/list` (ADMIN, BIDAN) — current prices from `v_harga_berlaku`, filters `ref_tipe` (ITEM|LAYANAN), `q`, pagination.
- `PUT /harga/:ref_tipe/:ref_id` (ADMIN) — body `{harga, berlaku_dari, alasan}`; validate ref_tipe else 422 ERR-VAL-02; call `dbo.sp_ubah_harga` with @diubah_oleh/@ip; negative harga → 422 ERR-PRC-01; duplicate open start → 422 ERR-PRC-01 (map THROW 50013).
- `POST /harga/:ref_tipe/:ref_id/riwayat/list` (ADMIN, BIDAN) — history ordered `berlaku_dari DESC`, pagination.
Never update price rows in place. Parameterized SQL.

Constraints: no other modules, no schema/SP changes, no plan/.omo edits. CommonJS, strict TS.

## Verify
1. `npx tsc --noEmit && npm run build && npm run audit:routes` (51/0).
2. Live on port 4226 (never foreground: `nohup ... &`, kill by PID within 60s):
   - admin login; PUT a scratch item price (create scratch item+price in a transaction or use an existing seed item's new future date) → 200; previous open row closes at date-1; history shows both; a visit-independent check via `fn_harga_berlaku` on the new date returns it.
   - `harga:-5` → 422 ERR-PRC-01; invalid ref_tipe → 422 ERR-VAL-02.
   - Clean scratch price rows; if you change a seed price, restore by deleting the new row and reopening the previous (`berlaku_sampai=NULL`).
3. Confirm no price UPDATE-in-place happened (only INSERT/close).

## Record/commit
Append to `.omo/evidence/task-26-praktik-bidan-monorepo.txt`; commit `feat(backend): add price list, change and history`. Only after the commit exists, print FINISH-26-abc123 on its own line plus a DoneClaim.