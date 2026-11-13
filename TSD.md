# Rangkuman Technical Specification Document (TSD)
## Sistem Digitalisasi Praktik Mandiri Bidan (Praktik Mandiri Bdn. Ria Indrasti J., S.Keb)

---

### Daftar Isi
1. [Identitas Proyek & Tim Pengembang](#1-identitas-proyek--tim-pengembang)
2. [Ruang Lingkup & Spesifikasi Kebutuhan Sistem](#2-ruang-lingkup--spesifikasi-kebutuhan-sistem)
3. [Arsitektur Sistem & Technology Stack](#3-arsitektur-sistem--technology-stack)
4. [Standar & Katalog RESTful API (51 Endpoint)](#4-standar--katalog-restful-api-51-endpoint)
5. [Perancangan Basis Data (18 Entitas & Objek SQL Server 2025)](#5-perancangan-basis-data-18-entitas--objek-sql-server-2025)
6. [Keamanan, Kontrol Akses (RBAC) & Otomatisasi](#6-keamanan-kontrol-akses-rbac--otomatisasi)

---

## 1. Identitas Proyek & Tim Pengembang

| Atribut | Keterangan |
| :--- | :--- |
| **Nama Sistem** | Sistem Digitalisasi Praktik Mandiri Bidan |
| **Mitra / Objek Studi** | Praktik Mandiri Bdn. Ria Indrasti J., S.Keb (Surakarta) |
| **Program Studi / Kelas** | S1 Sains Data (Kelas B) — FATISDA, Universitas Sebelas Maret |
| **Mata Kuliah** | Sistem Manajemen Basis Data (SMBD) / Rekayasa Sistem Informasi |
| **Dosen Pengampu** | Bambang Widoyono, S.T., M.T.I. |
| **Kelompok** | Kelompok 01 — *Tanpa Ampun* |

**Susunan Anggota Tim:**
1. **Muhammad Dzikri Reyfandy** — *Project Leader & UI/UX Designer*
2. **Muhammad Ghazy Hikmatiar** — *Frontend Developer*
3. **Muhammad Naufal Hafizh Fauzia Putra** — *Frontend Developer*
4. **Rasya Pradipta Effendi** — *Backend & Database Developer*

---

## 2. Ruang Lingkup & Spesifikasi Kebutuhan Sistem

Sistem ini dibangun sebagai aplikasi web terpadu untuk menggantikan pencatatan manual pada operasional harian praktik mandiri bidan, meliputi pendaftaran pasien, manajemen antrean, Rekam Medis Elektronik (RME), keselamatan pasien (*Red-Flag*), penagihan keuangan, pengendalian inventaris, hingga pelaporan analitik.

### 2.1 Kebutuhan Bisnis (BRD: BO-001 s.d. BO-006 & BR-001 s.d. BR-008)
* **Digitalisasi Rekam Medis (BO-001, BR-001):** Menyimpan profil pasien, riwayat kunjungan, diagnosis, tindakan, dan resep secara terpusat agar pencarian riwayat medis berlangsung dalam hitungan detik.
* **Reservasi & Antrean Online (BO-002, BR-003, BR-006):** Menyediakan pendaftaran satu pintu secara daring, penerbitan nomor antrean otomatis, estimasi jam kedatangan berbasis durasi per pasien, serta pengingat jadwal otomatis.
* **Keselamatan Pasien / Red-Flag (BO-003, BR-002):** Menampilkan peringatan visual otomatis atas riwayat alergi obat, penyakit bawaan, maupun kehamilan risiko tinggi sebelum pemeriksaan dilakukan.
* **Otomatisasi Keuangan & Penagihan (BO-004, BR-004, BR-008):** Menghitung total tagihan per kunjungan secara otomatis (jasa layanan dan obat/produk) berdasarkan *snapshot* harga berlaku serta menyusun rekapitulasi pendapatan harian/bulanan.
* **Profil Publik & Dashboard Analitik (BO-005, BR-005, BR-007):** Menyediakan beranda publik untuk *branding* praktik dan dashboard analitik tren layanan, jam tersibuk, serta performa praktik.
* **Manajemen Inventaris Real-Time (BO-006):** Memantau jumlah stok obat/produk kesehatan secara *real-time* beserta peringatan otomatis untuk stok di bawah batas minimum dan item mendekati kedaluwarsa.

### 2.2 Kebutuhan Fungsional (SRS & FSD: FR-001 s.d. FR-056 — 11 Modul)

| No | Modul Fungsional | Kode Referensi | Ringkasan Spesifikasi |
| :-: | :--- | :--- | :--- |
| 1 | **Autentikasi & Otorisasi** | `FR-045` s.d. `FR-049` | Login berbasis peran (`BIDAN`, `ADMIN`), penguncian akun 15 menit setelah 5 kali gagal login, *auto-logout* 30 menit tanpa aktivitas, serta reset kata sandi via OTP 6 digit WhatsApp. |
| 2 | **Halaman Publik & Branding** | `FR-042` s.d. `FR-044` | Menampilkan profil praktik, daftar layanan aktif, kontak, galeri, serta testimoni pasien (hanya menampilkan inisial nama sesuai kepatuhan UU PDP). |
| 3 | **Pendaftaran & Antrean** | `FR-001` s.d. `FR-010` | Reservasi online pasien baru/lama (validasi NIK 16 digit), pendaftaran *walk-in* oleh Admin, pembatasan kuota sesi praktik, serta *reschedule*/pembatalan dengan penyusunan ulang antrean otomatis. |
| 4 | **Rekam Medis Elektronik (RME)** | `FR-011` s.d. `FR-019` | Pencatatan pemeriksaan bersifat *append-only* (koreksi menautkan ke entri asal tanpa menimpa data lama), pencarian riwayat pasien, penambahan catatan bebas, larangan akses RME bagi Admin, dan ekspor ringkasan RME ke PDF. |
| 5 | **Keselamatan Pasien (Red-Flag)** | `FR-020` s.d. `FR-024` | Banner peringatan pada pasien berisiko, kewajiban centang konfirmasi baca sebelum mengisi formulir pemeriksaan, serta validasi otomatis resep obat terhadap alergi pasien. |
| 6 | **Keuangan & Penagihan** | `FR-025` s.d. `FR-030` | Kalkulasi tagihan otomatis berbasis *snapshot* harga berlaku, pencatatan pembayaran penuh maupun sebagian (DP/cicilan), dan pelacakan status `LUNAS` / `BELUM_LUNAS`. |
| 7 | **Manajemen Inventaris** | `FR-031` s.d. `FR-037` | Pengurangan stok otomatis saat obat diresepkan, pencegahan stok negatif dengan penguncian baris transaksi, pencatatan *restock*, serta peringatan stok minimum dan kedaluwarsa $\le 3$ bulan. |
| 8 | **Harga & Riwayat Harga** | `FR-054` s.d. `FR-056` | Pengelolaan tarif layanan dan harga jual obat/produk secara *append-only* (menutup `berlaku_sampai` harga lama dan mencatat harga baru beserta alasan perubahan). |
| 9 | **Dashboard & Laporan Analitik** | `FR-038` s.d. `FR-041`, `FR-056` | Ringkasan kunjungan, grafik tren layanan/diagnosis terbanyak, jam tersibuk 30 hari terakhir, analisis dekomposisi selisih pendapatan (efek volume vs efek harga), dan ekspor PDF/Excel. |
| 10 | **Notifikasi & Pengingat** | `FR-050` s.d. `FR-053` | Pengiriman pesan otomatis asinkron (konfirmasi reservasi, pengingat H-1 pukul 08:00 WIB, peringatan inventaris setiap Senin pukul 07:00 WIB) beserta log pengiriman dan fitur kirim ulang. |
| 11 | **Audit Log Immutable** | `DR-008`, `NFR-007` | Pencatatan jejak akses (`VIEW_RME`, `DATA_EXPORTED`) dan seluruh mutasi data (`INSERT`, `UPDATE`, `DELETE` beserta `nilai_lama` dan `nilai_baru` dalam format JSON) secara mutlak *append-only*. |

### 2.3 Kebutuhan Data & Non-Fungsional (DR-001 s.d. DR-010 & NFR-001 s.d. NFR-013)
* **Kapasitas & Performa:** Mendukung pertumbuhan hingga minimal $\ge 10.000$ profil pasien tanpa degradasi performa signifikan (`NFR-013`), waktu respons pencarian riwayat pasien $\le 2$ detik pada P95 (`FSD BR-28`), serta transaksi klinis/keuangan atomik $\le 800\text{ ms}$.
* **Ketersediaan & Pemulihan Bencana:** Target *uptime* minimal $\ge 99\%$ pada jam operasional praktik (`NFR-004`) dengan *Full Recovery Model* SQL Server berupa *full backup* harian (1x sehari) dan *transaction log backup* setiap 30 menit.
* **Keamanan & Kepatuhan Regulasi:** Kepatuhan penuh terhadap **UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)**, enkripsi komunikasi HTTPS **TLS 1.3**, *hashing* kata sandi `bcrypt` (*cost* 12), pemisahan tabel kredensial dari tabel medis, serta *parameterized queries* untuk mencegah *SQL Injection*.

---

## 3. Arsitektur Sistem & Technology Stack

Sistem menerapkan arsitektur *3-Tier Web Application* yang di-host pada lingkungan **Windows Server 2022**:

| Lapisan | Teknologi & Komponen Utama | Peran Teknis |
| :--- | :--- | :--- |
| **Web Server & Reverse Proxy** | **IIS 10+** (ARR / URL Rewrite) & **PM2 5.4.x** | Terminasi SSL/TLS 1.3, penyaji aset statis SPA, *reverse proxy* ke API Node.js, dan manajemen proses *Windows Service*. |
| **Frontend (SPA)** | **React 18.3.x**, **Vite 5.4.x**, TypeScript, Tailwind CSS, shadcn/ui, `react-router-dom` 6.x, `axios` 1.x, `recharts` 2.x | Antarmuka pengguna responsif untuk beranda publik, portal Admin operasional, dan portal RME/analitik Bidan. |
| **Backend (REST API)** | **Node.js 22 LTS**, **Express.js 4.21.x**, TypeScript (`Routes` $\rightarrow$ `Controllers` $\rightarrow$ `Services` $\rightarrow$ `Repositories`) | Logika bisnis, validasi skema (`zod` 3.x), autentikasi (`jsonwebtoken` 9.x, `bcrypt` 5.x), keamanan header (`helmet` 7.x, `express-rate-limit` 7.x), penjadwalan (`node-cron` 3.x), dan ekspor dokumen (`pdfkit` 0.15.x, `exceljs` 4.4.x). |
| **Database Engine** | **Microsoft SQL Server 2025** (driver `mssql` 11.x) | Penyimpanan relasional transaksional (ACID), eksekusi *Stored Procedures*, *Scalar Functions*, *Views*, *DML Triggers*, dan manajemen *session context*. |
| **Layanan Eksternal** | **Gateway Pesan WhatsApp Pihak Ketiga** (REST API HTTPS) | Pengiriman pesan asinkron untuk OTP reset kata sandi, konfirmasi reservasi, pengingat H-1, dan peringatan stok menipis. |

---

## 4. Standar & Katalog RESTful API (51 Endpoint)

### 4.1 Konvensi Desain API (TSD Bagian 3.1)
* **Base URL:** `/api/v1/`
* **Aturan Metode HTTP (Tanpa `GET`):** Seluruh operasi pembacaan data **tidak menggunakan HTTP `GET`**, melainkan wajib menggunakan **`POST`** dengan parameter filter, pencarian, pengurutan, dan paginasi di dalam *request body* JSON (akhiran `/list` untuk koleksi, `/detail` untuk entitas tunggal). Metode `POST` juga digunakan untuk pembuatan data/aksi, `PATCH` untuk pembaruan sebagian, `PUT` untuk penggantian tarif harga, dan `DELETE` untuk *soft delete*.
* **Format Envelope Respons:**
  * **Sukses:**
    ```json
    {
      "status": "success",
      "data": {},
      "message": "Pesan deskriptif",
      "meta": { "current_page": 1, "per_page": 15, "total": 45, "last_page": 3 }
    }
    ```
  * **Error:**
    ```json
    {
      "status": "error",
      "error_code": "ERR-RSV-01",
      "message": "Kuota sesi praktik sudah penuh",
      "errors": []
    }
    ```
* **Katalog Kode Error Resmi:** `ERR-AUTH-01` s.d. `05`, `ERR-LOCK-01`, `ERR-RSV-01` s.d. `05`, `ERR-RME-01` s.d. `04`, `ERR-INV-01` s.d. `03`, `ERR-FIN-01` s.d. `02`, `ERR-PRC-01`, `ERR-CNT-01`, `ERR-NTF-01`, `ERR-RPT-01`, `ERR-VAL-01` s.d. `04`, dan `ERR-SYS-01` s.d. `03`.

### 4.2 Daftar Lengkap 51 Endpoint API

1. **Modul Autentikasi (5 Endpoint):**
   * `POST /auth/login` *(Public)* — Login & pemeriksaan *lockout* akun.
   * `POST /auth/logout` *(Bidan, Admin)* — Invalidasi sesi.
   * `POST /auth/refresh` *(Bidan, Admin)* — Pembaruan token JWT (masa berlaku 30 menit).
   * `POST /auth/reset/request` *(Public)* — Permintaan OTP 6 digit via WhatsApp.
   * `POST /auth/reset/verify` *(Public)* — Verifikasi OTP & pembaruan kata sandi.
2. **Modul Halaman Publik & Reservasi Online (5 Endpoint):**
   * `POST /public/konten/list` *(Public)* — Daftar konten profil, galeri, kontak, dan testimoni.
   * `POST /public/layanan/list` *(Public)* — Daftar layanan aktif praktik.
   * `POST /public/sesi/list` *(Public)* — Jadwal sesi praktik & sisa kuota tersedia.
   * `POST /public/pasien/cek` *(Public)* — Pengecekan status pasien lama/baru via NIK/nomor telepon.
   * `POST /public/reservasi` *(Public)* — Pembuatan reservasi daring via `sp_buat_reservasi`.
3. **Modul Pendaftaran, Sesi & Antrean (9 Endpoint):**
   * `POST /pasien/identitas/list` *(Admin, Bidan)* — Pencarian data identitas pasien.
   * `POST /pasien/walk-in` *(Admin)* — Pendaftaran pasien datang langsung (*walk-in*).
   * `POST /reservasi/list` *(Admin, Bidan)* — Daftar reservasi & antrean harian.
   * `PATCH /reservasi/:id/jadwal` *(Admin)* — Penjadwalan ulang via `sp_reschedule_reservasi`.
   * `PATCH /reservasi/:id/batal` *(Admin)* — Pembatalan reservasi & susun ulang antrean.
   * `POST /sesi/list` *(Admin)* — Daftar jadwal sesi praktik.
   * `POST /sesi` *(Admin)* — Pembuatan sesi praktik baru.
   * `PATCH /sesi/:id` *(Admin)* — Pembaruan kuota/status sesi praktik.
   * `PATCH /reservasi/:id/status` *(Bidan)* — Pembaruan status panggilan/pemeriksaan pasien.
4. **Modul Rekam Medis Elektronik & Keselamatan Pasien (8 Endpoint — Khusus Bidan):**
   * `POST /pasien/list` *(Bidan)* — Daftar pasien beserta status penanda *Red-Flag*.
   * `POST /pasien/:id/rme/detail` *(Bidan)* — Detail profil medis & riwayat kunjungan (mencatat `VIEW_RME`).
   * `POST /pasien/:id/alergi` *(Bidan)* — Penambahan catatan alergi obat/penyakit bawaan/kehamilan risiko tinggi.
   * `PATCH /alergi/:id` *(Bidan)* — Pembaruan status aktif kondisi/alergi.
   * `POST /pasien/:id/red-flag/konfirmasi` *(Bidan)* — Pencatatan konfirmasi baca peringatan *Red-Flag*.
   * `POST /pasien/:id/kunjungan` *(Bidan)* — Simpan pemeriksaan, resep, mutasi stok & tagihan via `sp_simpan_kunjungan`.
   * `PATCH /kunjungan/:id/catatan` *(Bidan)* — Penambahan catatan bebas (*append-only*).
   * `POST /pasien/:id/rme/export` *(Bidan)* — Unduh ringkasan RME PDF (mencatat `DATA_EXPORTED`).
5. **Modul Keuangan & Penagihan (4 Endpoint):**
   * `POST /kunjungan/:id/tagihan/detail` *(Admin)* — Rincian tagihan jasa & obat per kunjungan.
   * `POST /tagihan/:id/pembayaran` *(Admin)* — Pencatatan pembayaran penuh/DP via `sp_catat_pembayaran`.
   * `POST /tagihan/list` *(Admin)* — Daftar tagihan (`LUNAS` / `BELUM_LUNAS`).
   * `POST /keuangan/rekap/list` *(Admin, Bidan)* — Rekapitulasi pendapatan harian/bulanan.
6. **Modul Inventaris & Manajemen Harga (8 Endpoint):**
   * `POST /inventaris/list` *(Admin, Bidan)* — Daftar stok obat/produk beserta status menipis/kedaluwarsa.
   * `POST /inventaris` *(Admin)* — Penambahan master item inventaris baru.
   * `PATCH /inventaris/:id` *(Admin)* — Pembaruan metadata/batas minimum stok item.
   * `POST /inventaris/:id/restock` *(Admin)* — Penambahan stok masuk via `sp_restock_item`.
   * `POST /inventaris/:id/riwayat/list` *(Admin, Bidan)* — Riwayat mutasi stok (`RESTOCK`, `PAKAI`, `KOREKSI`).
   * `POST /harga/list` *(Admin, Bidan)* — Daftar tarif layanan & item yang sedang berlaku.
   * `PUT /harga/:ref_tipe/:ref_id` *(Admin)* — Perubahan tarif *append-only* via `sp_ubah_harga`.
   * `POST /harga/:ref_tipe/:ref_id/riwayat/list` *(Admin, Bidan)* — Riwayat historis perubahan harga.
7. **Modul Dashboard & Laporan Analitik (5 Endpoint — Khusus Bidan):**
   * `POST /laporan/ringkasan/list` *(Bidan)* — Ringkasan KPI kunjungan & pendapatan.
   * `POST /laporan/tren-layanan/list` *(Bidan)* — Tren layanan dan diagnosis terbanyak.
   * `POST /laporan/jam-tersibuk/list` *(Bidan)* — Distribusi jam kunjungan tersibuk 30 hari terakhir.
   * `POST /laporan/perbandingan/list` *(Bidan)* — Analisis dekomposisi selisih pendapatan (efek volume vs efek harga).
   * `POST /laporan/export` *(Bidan)* — Ekspor laporan operasional ke format PDF atau Excel (`.xlsx`).
8. **Modul Konten Publik, Notifikasi & Audit Logs (7 Endpoint):**
   * `POST /konten/list` *(Admin)* — Daftar seluruh konten publik.
   * `POST /konten` *(Admin)* — Tambah konten publik baru.
   * `PATCH /konten/:id` *(Admin)* — Ubah isi/urutan konten publik.
   * `DELETE /konten/:id` *(Admin)* — *Soft delete* konten publik (`is_published = 0`).
   * `POST /notifikasi/log/list` *(Admin)* — Log status pengiriman pesan WhatsApp.
   * `POST /notifikasi/:id/kirim-ulang` *(Admin)* — Pengiriman ulang notifikasi gagal.
   * `POST /audit-logs/list` *(Bidan)* — Penelusuran jejak audit sistem (`audit_logs`).

---

## 5. Perancangan Basis Data (18 Entitas & Objek SQL Server 2025)

### 5.1 Struktur 18 Tabel Relasional
Seluruh tabel menggunakan kunci utama `UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID()` untuk mencegah tebakan ID pada URL, kecuali `audit_logs` yang menggunakan `BIGINT IDENTITY(1,1)` demi menjamin urutan kronologis:

| Kelompok Domain | Nama Tabel | Kunci Utama (PK) | Kunci Tamu (FK) & Keterangan Utama |
| :--- | :--- | :--- | :--- |
| **Autentikasi & Audit** | `users` | `user_id` | Akun internal (`BIDAN`, `ADMIN`), `failed_attempts` ($0\text{--}5$), `locked_until`. |
| | `otp_reset` | `otp_id` | FK `user_id` (`ON DELETE CASCADE`), menyimpan *hash* OTP 6 digit & masa berlaku. |
| | `audit_logs` | `log_id` (`BIGINT`) | FK `user_id` (`ON DELETE SET NULL`), `user_ref`, `nilai_lama` & `nilai_baru` (`ISJSON`). |
| **Pasien & Reservasi** | `pasien` | `pasien_id` | Identitas pasien dengan `nik CHAR(16) UNIQUE`. |
| | `sesi_praktik` | `sesi_id` | Jadwal buka praktik per `tanggal`, `kuota_maks`, `durasi_per_pasien` (default 15 menit). |
| | `layanan` | `layanan_id` | Master layanan kategori `KEBIDANAN` atau `UMUM`. |
| | `reservasi` | `reservasi_id` | FK `pasien_id`, `sesi_id`, `layanan_id`, `dibuat_oleh`; `nomor_antrean`, `estimasi_jam`. |
| **RME & Keselamatan** | `kunjungan` | `kunjungan_id` | FK `pasien_id`, `reservasi_id`, `bidan_id`, `layanan_id`, `koreksi_dari_id` (*self-ref*). |
| | `resep_item` | `resep_id` | FK `kunjungan_id`, `item_id`; mencatat jumlah & aturan pakai obat yang diresepkan. |
| | `alergi_kondisi` | `alergi_id` | FK `pasien_id`, `item_id`, `dicatat_oleh`; kategori `ALERGI_OBAT`, `KEHAMILAN_RISTI`, `PENYAKIT_BAWAAN`. |
| **Inventaris & Harga** | `item_inventaris` | `item_id` | Master `OBAT` & `PRODUK_KESEHATAN`, constraint `stok >= 0`, `stok_minimum`, `tgl_kedaluwarsa`. |
| | `riwayat_stok` | `riwayat_id` | FK `item_id`, `kunjungan_id`, `user_id`; mutasi jenis `RESTOCK`, `PAKAI`, `KOREKSI`. |
| | `riwayat_harga` | `harga_id` | FK `item_id`, `layanan_id`, `diubah_oleh`; rentang `berlaku_dari` s.d. `berlaku_sampai`. |
| **Keuangan** | `tagihan` | `tagihan_id` | FK `kunjungan_id` (`UNIQUE`, relasi $1:1$), `total_tagihan`, `total_dibayar`, `status`. |
| | `tagihan_rincian` | `rincian_id` | FK `tagihan_id` (`ON DELETE CASCADE`), `item_id`, `layanan_id`; kolom `subtotal` (`PERSISTED`). |
| | `pembayaran` | `pembayaran_id` | FK `tagihan_id`, `dicatat_oleh`; jalur `MANDIRI`, `BPJS`, atau `ASURANSI`. |
| **Publik & Notifikasi** | `konten_publik` | `konten_id` | Konten beranda (`PROFIL`, `LAYANAN`, `KONTAK`, `GALERI`, `TESTIMONI`). |
| | `log_notifikasi` | `notif_id` | FK `reservasi_id`; jenis `KONFIRMASI`, `PENGINGAT_H1`, `PERUBAHAN`, `INVENTARIS`, `OTP`. |

### 5.2 Batasan Integritas & Objek Pemrograman SQL Server
* **Batasan Kunci (DBC-01 s.d. DBC-08):**
  * *Soft Delete* (`DBC-04`): Penonaktifan data menggunakan `is_active = 0` atau `is_published = 0` (tanpa `DELETE` fisik pada data pasien/klinis).
  * *Filtered Unique Index* (`DBC-05`): `UNIQUE INDEX` pada `reservasi(sesi_id, nomor_antrean) WHERE status <> 'DIBATALKAN'`.
  * *Immutability Audit* (`DBC-07`): Tabel `audit_logs` dilindungi trigger `INSTEAD OF UPDATE, DELETE`.
* **4 Scalar Functions:** `dbo.fn_hitung_estimasi_jam`, `dbo.fn_status_stok`, `dbo.fn_harga_berlaku`, dan `dbo.fn_cek_alergi`.
* **14 Database Views:** `v_antrean_harian`, `v_tagihan_belum_lunas`, `v_rekap_pendapatan`, `v_inventaris_status`, `v_harga_berlaku`, `v_rekap_kunjungan_harian`, `v_tren_layanan`, `v_jam_tersibuk`, `v_penjualan_item_periode`, `v_audit_log_detail`, `v_sesi_sisa_kuota`, `v_profil_rme`, `v_tagihan_detail`, dan `v_riwayat_stok_item`.
* **6 Stored Procedures Atomik (dengan `SET XACT_ABORT ON` & `UPDLOCK`):**
  1. `dbo.sp_buat_reservasi` — Validasi kuota, pembuatan profil pasien baru/lama, dan penomoran antrean otomatis.
  2. `dbo.sp_reschedule_reservasi` — Pemindahan jadwal atau pembatalan serta pengurutan ulang nomor antrean sesi asal.
  3. `dbo.sp_simpan_kunjungan` — Transaksi atomik simpan RME, validasi alergi obat, pemotongan stok dengan penguncian baris (`UPDLOCK`), dan pembuatan tagihan otomatis menggunakan *Table-Valued Parameter* (`dbo.tvp_resep`).
  4. `dbo.sp_catat_pembayaran` — Pencatatan cicilan/pelunasan dan pembaruan status tagihan.
  5. `dbo.sp_restock_item` — Penambahan stok fisik, pencatatan mutasi `RESTOCK`, dan pembaruan tanggal kedaluwarsa.
  6. `dbo.sp_ubah_harga` — Penutupan masa berlaku harga aktif lama dan penyisipan harga baru (*append-only*).
* **16 DML Triggers:** 15 trigger `AFTER INSERT, UPDATE, DELETE` pada tabel bisnis yang membaca `SESSION_CONTEXT(N'user_id')` dan `SESSION_CONTEXT(N'ip')` untuk mencatat perubahan JSON ke `audit_logs`, ditambah 1 trigger `trg_audit_logs_immutable`.

---

## 6. Keamanan, Kontrol Akses (RBAC) & Otomatisasi

### 6.1 Matriks Peran Pengguna (*Least Privilege*)

| Peran | Kategori | Hak Akses Utama | Pembatasan Keamanan |
| :--- | :--- | :--- | :--- |
| **`BIDAN`** | Admin 1 *(Klinis & Pemilik)* | Akses penuh RME, alergi/Red-Flag, ekspor PDF RME, laporan analitik & dekomposisi pendapatan, serta meninjau `audit_logs`. | Setiap pembukaan RME (`VIEW_RME`) dan ekspor (`DATA_EXPORTED`) otomatis tercatat di `audit_logs`. |
| **`ADMIN`** | Admin 2 *(Operasional)* | Pendaftaran *walk-in*, manajemen sesi & antrean, penagihan & pembayaran, *restock* inventaris, perubahan tarif, konten publik, dan log notifikasi. | Diblokir total dari seluruh endpoint RME (`kunjungan`, `alergi_kondisi`) dan `audit_logs` (`ERR-AUTH-03`). |
| **`DB_APP_USER` / `SYSADMIN`** | Sistem & DBA | DBA mengelola *backup* harian & log 30 menit; akun layanan aplikasi mengeksekusi SP/Views dengan `SESSION_CONTEXT`. | Akun aplikasi tidak memiliki hak DDL maupun hak `UPDATE`/`DELETE` pada `audit_logs`. |
| **`PASIEN`** | *Naive User* (Publik) | Melihat layanan, jadwal sesi, sisa kuota, cek status pasien, dan membuat reservasi online. | Tanpa kredensial login DB; dibatasi *rate limit* 10 request/menit per IP tanpa akses data medis. |

### 6.2 Penjadwalan Otomatis (*Cron Jobs* — `Asia/Jakarta`)
* **Pengingat Jadwal Kunjungan H-1 (`0 8 * * *`):** Berjalan setiap hari pukul **08:00 WIB** untuk mengirimkan pesan pengingat WhatsApp kepada pasien yang memiliki jadwal reservasi pada keesokan hari.
* **Peringatan Inventaris Mingguan (`0 7 * * 1`):** Berjalan setiap hari **Senin pukul 07:00 WIB** untuk mengirimkan ringkasan obat/produk yang berada di bawah stok minimum atau akan kedaluwarsa dalam 3 bulan ke depan.