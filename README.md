# Praktik Mandiri Bidan

## Prerequisites
- Node.js 22
- SQL Server 2025 (sudah terpasang lokal) dengan `sqlcmd`
- SSMS (opsional)
- Tanpa Docker

## Development

### 1) Siapkan SQL Server
- Jalankan service SQL Server lokal (pastikan instance aktif dan dapat diakses).

### 2) Konfigurasi backend environment
```bash
cp backend/.env.example backend/.env
```
Isi `DB_PASSWORD` di `backend/.env` (dan sesuaikan `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME` bila perlu). Nilai default contoh: `DB_HOST=localhost`, `DB_PORT=1433`, `DB_NAME=PraktikBidan`, `DB_USER=sa`, `DB_ENCRYPT=false`, `DB_TRUST_CERT=true`.

### 3) Jalankan migrasi/seed SQL (urutan wajib)
> Database diasumsikan sudah termigrasi pada lingkungan ini; **jangan menjalankan ulang** skrip SQL berikut. Daftar urutan file untuk referensi/setup lingkungan baru (jalankan berurutan 01–05, jangan diacak):

1. `backend/database/01_schema.sql`
2. `backend/database/02_indexes.sql`
3. `backend/database/03_procedures.sql`
4. `backend/database/04_triggers.sql`
5. `backend/database/05_seed.sql`

Contoh perintah `sqlcmd` (sesuaikan server/port/user/database; tambahkan `-C` untuk sertifikat self-signed dev):
```bash
sqlcmd -S localhost,1433 -U sa -P "<DB_PASSWORD>" -C -d master -i backend/database/01_schema.sql
sqlcmd -S localhost,1433 -U sa -P "<DB_PASSWORD>" -C -d PraktikBidan -i backend/database/02_indexes.sql
sqlcmd -S localhost,1433 -U sa -P "<DB_PASSWORD>" -C -d PraktikBidan -i backend/database/03_procedures.sql
sqlcmd -S localhost,1433 -U sa -P "<DB_PASSWORD>" -C -d PraktikBidan -i backend/database/04_triggers.sql
sqlcmd -S localhost,1433 -U sa -P "<DB_PASSWORD>" -C -d PraktikBidan -i backend/database/05_seed.sql
```

### 4) Jalankan backend
```bash
cd backend && npm install && npm run dev
```
Skrip tersedia (`backend/package.json`): `dev` (`tsx watch src/server.ts`), `build` (`tsc && tsc-alias`), `start` (`node dist/server.js`), `typecheck`, `audit:routes`.

### 5) Jalankan frontend
```bash
cd frontend && npm install && npm run dev
```
Skrip tersedia (`frontend/package.json`): `dev` (`vite`), `build` (`tsc -b && vite build`), `typecheck`, `preview`.

## Seed credentials
Dari `backend/database/05_seed.sql` (untuk pengembangan lokal; **wajib diganti di produksi**):
- Bidan: `bidan` / `Bidan#2026`
- Admin: `admin` / `Admin#2026`

## Postman
1. Import collection: `backend/docs/postman/Praktik_Mandiri_Bidan_API.postman_collection.json`
2. Import environment: `backend/docs/postman/Local_Dev.postman_environment.json`
3. Set `baseUrl` sesuai backend (default `http://localhost:3000`).
4. Jalankan request login (mis. `POST /api/auth/login`) dengan kredensial seed; token/session akan dipakai untuk request terproteksi.

## Production deployment

### Frontend (Vercel)
- Build command: `npm run build`
- Output directory: `dist`
- Environment: `VITE_API_BASE_URL` diarahkan ke URL backend produksi (HTTPS)

### Backend (PM2 + IIS/nginx reverse proxy)
- Build & start: `npm install`, `npm run build`, `npm run start` (atau kelola proses dengan PM2)
- Reverse proxy: IIS atau nginx di depan Node.js, terminasi **HTTPS**
- Konfigurasi: set `NODE_ENV=production`, `CORS_ORIGINS` sebagai allowlist domain frontend, aktifkan `trust proxy` di lingkungan ber-proxy, gunakan `JWT_SECRET` kuat dan rahasiakan kredensial DB
- Database: SQL Server native dengan backup harian full + log backup setiap 30 menit

## Troubleshooting
- **Instance tidak listen di 1433 / port salah**: cek SQL Server Configuration Manager (TCP/IP enabled, port), pastikan `DB_HOST`/`DB_PORT` di `.env` sesuai instance.
- **Mixed-mode auth dinonaktifkan**: aktifkan SQL Server and Windows Authentication Mode untuk login `sa`/SQL login, lalu restart service.
- **`sqlcmd -C` untuk sertifikat self-signed dev**: gunakan flag `-C` saat `DB_ENCRYPT/TrustServerCertificate` dev memakai self-signed cert agar koneksi/eksekusi tidak gagal verifikasi.
- **Bcrypt native build note**: dependensi `bcrypt` butuh toolchain native (Python/build tools) saat install; bila gagal build, pastikan Node 22 dan build tools tersedia lalu `npm install` ulang.
- **Peringatan port 1433 terekspos**: jangan membuka port 1433 ke publik/internet; batasi akses ke jaringan privat/firewall dan gunakan kredensial kuat.
