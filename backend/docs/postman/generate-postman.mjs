#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

const authHeader = [{ key: 'Authorization', value: 'Bearer {{token}}', type: 'text' }];
const jsonHeader = [{ key: 'Content-Type', value: 'application/json', type: 'text' }];

const saveScript = (pairs) => {
  if (!pairs || pairs.length === 0) return [];
  const lines = [
    'if (pm.response.code >= 200 && pm.response.code < 300) {',
    '  const json = pm.response.json();',
    '  const data = json && json.data ? json.data : {};'
  ];
  for (const [env, expr] of pairs) {
    lines.push(`  const v_${env} = ${expr};`);
    lines.push(`  if (v_${env} !== undefined && v_${env} !== null) pm.environment.set('${env}', v_${env});`);
  }
  lines.push('}');
  return [{ listen: 'test', script: { type: 'text/javascript', exec: lines } }];
};

const desc = (name, roles, fsd, errors, extra = '') => {
  const roleText = roles === 'PUBLIC' ? 'Public (tanpa autentikasi)' : `Peran diizinkan: ${roles.join(', ')}`;
  const parts = [
    `Endpoint: ${name}`,
    roleText,
    `Referensi FSD: ${fsd}`,
    `Kemungkinan error: ${errors.join(', ')}`,
  ];
  if (extra) parts.push(extra);
  return parts.join('\n');
};

const req = (spec) => {
  const urlPath = spec.path.replace(/^\//, '').split('/').filter(Boolean);
  const rawPath = spec.path.replace(/:([A-Za-z0-9_]+)/g, '{{$1}}');
  const request = {
    method: spec.method,
    header: [...(spec.body ? jsonHeader : []), ...(spec.auth ? authHeader : [])],
    url: {
      raw: `{{baseUrl}}/api/v1${rawPath}`,
      host: ['{{baseUrl}}'],
      path: ['api', 'v1', ...urlPath.map((s) => s.replace(/:([A-Za-z0-9_]+)/g, '{{$1}}'))],
    },
    description: spec.description,
  };
  if (spec.body) {
    request.body = { mode: 'raw', raw: JSON.stringify(spec.body, null, 2), options: { raw: { language: 'json' } } };
  }
  return {
    name: spec.name,
    request,
    response: [],
    ...(spec.tests ? { event: spec.tests } : {}),
  };
};

const U = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333333';

const spec = [
  // 1. Auth
  { folder: '1. Auth', name: 'Login', method: 'POST', path: '/auth/login', roles: 'PUBLIC', auth: false, fsd: 'Bagian 1.6 / Auth', errors: ['ERR-AUTH-01','ERR-AUTH-05','ERR-LOCK-01','ERR-VAL-01','ERR-SYS-03'],
    body: { username: 'bidan', password: 'Bidan#2026' },
    tests: saveScript([['token','data.token || data.access_token'], ['user_id','data.user && data.user.id ? data.user.id : data.user_id']]) },
  { folder: '1. Auth', name: 'Logout', method: 'POST', path: '/auth/logout', roles: ['ADMIN','BIDAN'], auth: true, fsd: 'Bagian 1.6 / Auth', errors: ['ERR-AUTH-02','ERR-AUTH-04'], body: {} },
  { folder: '1. Auth', name: 'Refresh Token', method: 'POST', path: '/auth/refresh', roles: ['ADMIN','BIDAN'], auth: true, fsd: 'Bagian 1.6 / Auth', errors: ['ERR-AUTH-02','ERR-AUTH-04'],
    body: {}, tests: saveScript([['token','data.token || data.access_token']]) },
  { folder: '1. Auth', name: 'Reset Password Request (OTP)', method: 'POST', path: '/auth/reset/request', roles: 'PUBLIC', auth: false, fsd: 'Bagian 1.6 / Auth', errors: ['ERR-VAL-01','ERR-NTF-01','ERR-SYS-03'],
    body: { username: 'bidan' } },
  { folder: '1. Auth', name: 'Reset Password Verify', method: 'POST', path: '/auth/reset/verify', roles: 'PUBLIC', auth: false, fsd: 'Bagian 1.6 / Auth', errors: ['ERR-AUTH-01','ERR-VAL-01','ERR-SYS-03'],
    body: { username: 'bidan', kode: '123456', password_baru: 'PasswordBaru#2026' } },

  // 2. Public
  { folder: '2. Public', name: 'List Konten Publik', method: 'POST', path: '/public/konten/list', roles: 'PUBLIC', auth: false, fsd: 'Bagian 1.6 / Public', errors: ['ERR-VAL-03'],
    body: { tipe: 'PROFIL', page: 1, per_page: 10 } },
  { folder: '2. Public', name: 'List Layanan Publik', method: 'POST', path: '/public/layanan/list', roles: 'PUBLIC', auth: false, fsd: 'Bagian 1.6 / Public', errors: ['ERR-VAL-03'],
    body: { page: 1, per_page: 10 } },
  { folder: '2. Public', name: 'List Sesi Publik', method: 'POST', path: '/public/sesi/list', roles: 'PUBLIC', auth: false, fsd: 'Bagian 1.6 / Public', errors: ['ERR-VAL-03'],
    body: { tanggal_dari: '2026-11-01', tanggal_sampai: '2026-11-30', page: 1, per_page: 10 } },
  { folder: '2. Public', name: 'Cek Pasien', method: 'POST', path: '/public/pasien/cek', roles: 'PUBLIC', auth: false, fsd: 'Bagian 1.6 / Public', errors: ['ERR-VAL-01','ERR-RME-01'],
    body: { no_telepon: '081234567890' }, tests: saveScript([['pasien_id','data.pasien_id']]) },
  { folder: '2. Public', name: 'Buat Reservasi Online', method: 'POST', path: '/public/reservasi', roles: 'PUBLIC', auth: false, fsd: 'Bagian 1.6 / Public', errors: ['ERR-VAL-01','ERR-RSV-01','ERR-RSV-02','ERR-RSV-05','ERR-SYS-02'],
    body: { sesi_id: '{{sesi_id}}', layanan_id: U2, pasien_baru: { nik: '3201010101010001', nama: 'Pasien Contoh', tgl_lahir: '1995-05-10', alamat: 'Jl. Contoh No. 1', no_telepon: '081234567890' } },
    tests: saveScript([['reservasi_id','data.reservasi_id || data.id'], ['pasien_id','data.pasien_id || (data.pasien && data.pasien.id) || data.pasien && data.pasien.pasien_id']]) },

  // 3. Pendaftaran & Antrean
  { folder: '3. Pendaftaran & Antrean', name: 'List Identitas Pasien', method: 'POST', path: '/pasien/identitas/list', roles: ['ADMIN','BIDAN'], auth: true, fsd: 'Bagian 1.6 / Pendaftaran & Antrean', errors: ['ERR-AUTH-02','ERR-AUTH-03','ERR-VAL-03'],
    body: { q: 'Pasien', page: 1, per_page: 10 } },
  { folder: '3. Pendaftaran & Antrean', name: 'Walk-in Pasien', method: 'POST', path: '/pasien/walk-in', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Pendaftaran & Antrean', errors: ['ERR-AUTH-03','ERR-VAL-01','ERR-RSV-01','ERR-RSV-02','ERR-RSV-05'],
    body: { sesi_id: '{{sesi_id}}', layanan_id: U2, pasien_baru: { nik: '3201010101010002', nama: 'Walkin Contoh', tgl_lahir: '1990-01-01', alamat: 'Jl. Walkin 2', no_telepon: '081298765432' } },
    tests: saveScript([['pasien_id','data.pasien_id || (data.pasien && data.pasien.id)'], ['reservasi_id','data.reservasi_id || data.id']]) },
  { folder: '3. Pendaftaran & Antrean', name: 'List Reservasi', method: 'POST', path: '/reservasi/list', roles: ['ADMIN','BIDAN'], auth: true, fsd: 'Bagian 1.6 / Pendaftaran & Antrean', errors: ['ERR-AUTH-03','ERR-VAL-03'],
    body: { tanggal: '2026-11-15', status: 'MENUNGGU', page: 1, per_page: 10 } },
  { folder: '3. Pendaftaran & Antrean', name: 'Reschedule Reservasi', method: 'PATCH', path: '/reservasi/:id/jadwal', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Pendaftaran & Antrean', errors: ['ERR-AUTH-03','ERR-RSV-01','ERR-RSV-02','ERR-RSV-03','ERR-RSV-04','ERR-VAL-01'],
    body: { sesi_id_baru: '{{sesi_id}}', alasan: 'Perubahan jadwal pasien' } },
  { folder: '3. Pendaftaran & Antrean', name: 'Batalkan Reservasi', method: 'PATCH', path: '/reservasi/:id/batal', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Pendaftaran & Antrean', errors: ['ERR-AUTH-03','ERR-RSV-03','ERR-RSV-04','ERR-VAL-01'],
    body: { alasan: 'Pasien berhalangan hadir' } },
  { folder: '3. Pendaftaran & Antrean', name: 'Update Status Reservasi', method: 'PATCH', path: '/reservasi/:id/status', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / Pendaftaran & Antrean', errors: ['ERR-AUTH-03','ERR-RSV-03','ERR-RSV-04','ERR-VAL-01'],
    body: { status: 'DIPANGGIL' } },
  { folder: '3. Pendaftaran & Antrean', name: 'List Sesi (Admin)', method: 'POST', path: '/sesi/list', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Pendaftaran & Antrean', errors: ['ERR-AUTH-03','ERR-VAL-03'],
    body: { tanggal_dari: '2026-11-01', tanggal_sampai: '2026-11-30', is_active: true, page: 1, per_page: 10 } },
  { folder: '3. Pendaftaran & Antrean', name: 'Buat Sesi', method: 'POST', path: '/sesi', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Pendaftaran & Antrean', errors: ['ERR-AUTH-03','ERR-RSV-02','ERR-VAL-01'],
    body: { tanggal: '2026-11-20', jam_mulai: '09:00', jam_selesai: '12:00', kuota_maks: 10, durasi_per_pasien: 15 },
    tests: saveScript([['sesi_id','data.sesi_id || data.id']]) },
  { folder: '3. Pendaftaran & Antrean', name: 'Update Sesi', method: 'PATCH', path: '/sesi/:id', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Pendaftaran & Antrean', errors: ['ERR-AUTH-03','ERR-RSV-01','ERR-RSV-02','ERR-VAL-01'],
    body: { kuota_maks: 12, is_active: true } },

  // 4. RME & Keselamatan Pasien
  { folder: '4. RME & Keselamatan Pasien', name: 'List Pasien (RME)', method: 'POST', path: '/pasien/list', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / RME & Keselamatan Pasien', errors: ['ERR-AUTH-03','ERR-VAL-03'],
    body: { q: 'Pasien', page: 1, per_page: 10 } },
  { folder: '4. RME & Keselamatan Pasien', name: 'Detail RME Pasien', method: 'POST', path: '/pasien/:id/rme/detail', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / RME & Keselamatan Pasien', errors: ['ERR-AUTH-03','ERR-RME-01','ERR-VAL-02'],
    body: {} },
  { folder: '4. RME & Keselamatan Pasien', name: 'Tambah Alergi/Kondisi Pasien', method: 'POST', path: '/pasien/:id/alergi', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / RME & Keselamatan Pasien', errors: ['ERR-AUTH-03','ERR-RME-01','ERR-VAL-01'],
    body: { kategori: 'KEHAMILAN_RISTI', nama: 'Hipertensi', keterangan: 'Tekanan darah tinggi' } },
  { folder: '4. RME & Keselamatan Pasien', name: 'Konfirmasi Red-Flag', method: 'POST', path: '/pasien/:id/red-flag/konfirmasi', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / RME & Keselamatan Pasien', errors: ['ERR-AUTH-03','ERR-RME-01','ERR-VAL-02'],
    body: {} },
  { folder: '4. RME & Keselamatan Pasien', name: 'Buat Kunjungan', method: 'POST', path: '/pasien/:id/kunjungan', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / RME & Keselamatan Pasien', errors: ['ERR-AUTH-03','ERR-RME-01','ERR-RME-03','ERR-RME-04','ERR-INV-02','ERR-VAL-01'],
    body: { reservasi_id: '{{reservasi_id}}', layanan_id: U2, tanggal_kunjungan: '2026-11-15T09:15:00+07:00', keluhan: 'Mual dan pusing', pemeriksaan_fisik: 'TD 120/80, suhu normal', diagnosis: 'Kehamilan normal trimester 1', tindakan: 'Konseling dan pemberian vitamin', catatan_bebas: 'Kontrol 1 bulan lagi', resep: [{ item_id: '{{item_id}}', jumlah: 1, aturan_pakai: '1x sehari setelah makan' }] },
    tests: saveScript([['kunjungan_id','data.kunjungan_id || data.id'], ['tagihan_id','data.tagihan_id']]) },
  { folder: '4. RME & Keselamatan Pasien', name: 'Export RME Pasien', method: 'POST', path: '/pasien/:id/rme/export', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / RME & Keselamatan Pasien', errors: ['ERR-AUTH-03','ERR-RME-01','ERR-RPT-01'],
    body: { format: 'pdf' } },
  { folder: '4. RME & Keselamatan Pasien', name: 'Update Alergi/Kondisi', method: 'PATCH', path: '/alergi/:id', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / RME & Keselamatan Pasien', errors: ['ERR-AUTH-03','ERR-VAL-01','ERR-VAL-02'],
    body: { is_active: true, keterangan: 'Dipantau rutin' } },
  { folder: '4. RME & Keselamatan Pasien', name: 'Tambah Catatan Kunjungan', method: 'PATCH', path: '/kunjungan/:id/catatan', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / RME & Keselamatan Pasien', errors: ['ERR-AUTH-03','ERR-RME-02','ERR-VAL-01'],
    body: { catatan: 'Pasien diminta kontrol ulang bila keluhan berlanjut.' } },

  // 5. Keuangan & Tagihan
  { folder: '5. Keuangan & Tagihan', name: 'Detail Tagihan Kunjungan', method: 'POST', path: '/kunjungan/:id/tagihan/detail', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Keuangan & Tagihan', errors: ['ERR-AUTH-03','ERR-FIN-01','ERR-RME-02'],
    body: {} },
  { folder: '5. Keuangan & Tagihan', name: 'List Tagihan', method: 'POST', path: '/tagihan/list', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Keuangan & Tagihan', errors: ['ERR-AUTH-03','ERR-VAL-03'],
    body: { status: 'BELUM_LUNAS', tanggal_dari: '2026-11-01', tanggal_sampai: '2026-11-30', page: 1, per_page: 10 } },
  { folder: '5. Keuangan & Tagihan', name: 'Catat Pembayaran Tagihan', method: 'POST', path: '/tagihan/:id/pembayaran', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Keuangan & Tagihan', errors: ['ERR-AUTH-03','ERR-FIN-01','ERR-FIN-02','ERR-VAL-01'],
    body: { jumlah: 50000, jalur: 'MANDIRI' } },
  { folder: '5. Keuangan & Tagihan', name: 'Rekap Pendapatan', method: 'POST', path: '/keuangan/rekap/list', roles: ['ADMIN','BIDAN'], auth: true, fsd: 'Bagian 1.6 / Keuangan & Tagihan', errors: ['ERR-AUTH-03','ERR-RPT-01'],
    body: { dari: '2026-11-01', sampai: '2026-11-30', grup: 'HARIAN' } },

  // 6. Inventaris
  { folder: '6. Inventaris', name: 'List Inventaris', method: 'POST', path: '/inventaris/list', roles: ['ADMIN','BIDAN'], auth: true, fsd: 'Bagian 1.6 / Inventaris', errors: ['ERR-AUTH-03','ERR-VAL-03'],
    body: { kategori: 'OBAT', q: 'vit', page: 1, per_page: 10 } },
  { folder: '6. Inventaris', name: 'Buat Item Inventaris', method: 'POST', path: '/inventaris', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Inventaris', errors: ['ERR-AUTH-03','ERR-INV-03','ERR-VAL-01'],
    body: { nama: 'Vitamin A 10000 IU', kategori: 'OBAT', satuan: 'kapsul', stok: 50, stok_minimum: 10, tgl_kedaluwarsa: '2027-12-31', harga: 2500 },
    tests: saveScript([['item_id','data.item_id || data.id']]) },
  { folder: '6. Inventaris', name: 'Update Item Inventaris', method: 'PATCH', path: '/inventaris/:id', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Inventaris', errors: ['ERR-AUTH-03','ERR-INV-01','ERR-VAL-01'],
    body: { stok_minimum: 15, is_active: true } },
  { folder: '6. Inventaris', name: 'Restock Item Inventaris', method: 'POST', path: '/inventaris/:id/restock', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Inventaris', errors: ['ERR-AUTH-03','ERR-INV-01','ERR-INV-03','ERR-VAL-01'],
    body: { jumlah: 20, harga_beli: 2200, tgl_kedaluwarsa: '2028-01-31' } },
  { folder: '6. Inventaris', name: 'Riwayat Stok Inventaris', method: 'POST', path: '/inventaris/:id/riwayat/list', roles: ['ADMIN','BIDAN'], auth: true, fsd: 'Bagian 1.6 / Inventaris', errors: ['ERR-AUTH-03','ERR-INV-01','ERR-VAL-03'],
    body: { jenis: 'RESTOCK', tanggal_dari: '2026-11-01', tanggal_sampai: '2026-11-30', page: 1, per_page: 10 } },

  // 7. Harga
  { folder: '7. Harga', name: 'List Harga', method: 'POST', path: '/harga/list', roles: ['ADMIN','BIDAN'], auth: true, fsd: 'Bagian 1.6 / Harga', errors: ['ERR-AUTH-03','ERR-VAL-03'],
    body: { ref_tipe: 'LAYANAN', q: 'periksa', page: 1, per_page: 10 } },
  { folder: '7. Harga', name: 'Ubah Harga', method: 'PUT', path: '/harga/:ref_tipe/:ref_id', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Harga', errors: ['ERR-AUTH-03','ERR-PRC-01','ERR-VAL-01','ERR-VAL-02'],
    body: { harga: 75000, berlaku_dari: '2026-12-01', alasan: 'Penyesuaian tarif 2026' } },
  { folder: '7. Harga', name: 'Riwayat Harga', method: 'POST', path: '/harga/:ref_tipe/:ref_id/riwayat/list', roles: ['ADMIN','BIDAN'], auth: true, fsd: 'Bagian 1.6 / Harga', errors: ['ERR-AUTH-03','ERR-VAL-02','ERR-VAL-03'],
    body: { page: 1, per_page: 10 } },

  // 8. Laporan Analitik
  { folder: '8. Laporan Analitik', name: 'Ringkasan Laporan', method: 'POST', path: '/laporan/ringkasan/list', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / Laporan Analitik', errors: ['ERR-AUTH-03','ERR-RPT-01'],
    body: { dari: '2026-11-01', sampai: '2026-11-30' } },
  { folder: '8. Laporan Analitik', name: 'Tren Layanan', method: 'POST', path: '/laporan/tren-layanan/list', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / Laporan Analitik', errors: ['ERR-AUTH-03','ERR-RPT-01'],
    body: { dari: '2026-11-01', sampai: '2026-11-30', grup: 'HARIAN' } },
  { folder: '8. Laporan Analitik', name: 'Jam Tersibuk', method: 'POST', path: '/laporan/jam-tersibuk/list', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / Laporan Analitik', errors: ['ERR-AUTH-03'],
    body: {} },
  { folder: '8. Laporan Analitik', name: 'Perbandingan Periode', method: 'POST', path: '/laporan/perbandingan/list', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / Laporan Analitik', errors: ['ERR-AUTH-03','ERR-RPT-01','ERR-VAL-01'],
    body: { periode_a: { dari: '2026-10-01', sampai: '2026-10-31' }, periode_b: { dari: '2026-11-01', sampai: '2026-11-30' }, grup: 'LAYANAN' } },
  { folder: '8. Laporan Analitik', name: 'Export Laporan', method: 'POST', path: '/laporan/export', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / Laporan Analitik', errors: ['ERR-AUTH-03','ERR-RPT-01'],
    body: { format: 'pdf', laporan: 'ringkasan', dari: '2026-11-01', sampai: '2026-11-30' } },

  // 9. Konten Publik
  { folder: '9. Konten Publik', name: 'List Konten (Admin)', method: 'POST', path: '/konten/list', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Konten Publik', errors: ['ERR-AUTH-03','ERR-VAL-03'],
    body: { tipe: 'PROFIL', is_published: true, page: 1, per_page: 10 } },
  { folder: '9. Konten Publik', name: 'Buat Konten', method: 'POST', path: '/konten', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Konten Publik', errors: ['ERR-AUTH-03','ERR-VAL-01'],
    body: { tipe: 'PROFIL', judul: 'Tentang Praktik', isi: 'Profil singkat praktik bidan.', media_url: 'https://example.com/profil.jpg', urutan: 1, is_published: true } },
  { folder: '9. Konten Publik', name: 'Update Konten', method: 'PATCH', path: '/konten/:id', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Konten Publik', errors: ['ERR-AUTH-03','ERR-CNT-01','ERR-VAL-01'],
    body: { judul: 'Tentang Praktik (Update)', is_published: true } },
  { folder: '9. Konten Publik', name: 'Hapus Konten', method: 'DELETE', path: '/konten/:id', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Konten Publik', errors: ['ERR-AUTH-03','ERR-CNT-01'] },

  // 10. Notifikasi
  { folder: '10. Notifikasi', name: 'List Log Notifikasi', method: 'POST', path: '/notifikasi/log/list', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Notifikasi', errors: ['ERR-AUTH-03','ERR-VAL-03'],
    body: { jenis: 'KONFIRMASI', status: 'GAGAL', tanggal_dari: '2026-11-01', tanggal_sampai: '2026-11-30', page: 1, per_page: 10 } },
  { folder: '10. Notifikasi', name: 'Kirim Ulang Notifikasi', method: 'POST', path: '/notifikasi/:id/kirim-ulang', roles: ['ADMIN'], auth: true, fsd: 'Bagian 1.6 / Notifikasi', errors: ['ERR-AUTH-03','ERR-NTF-01','ERR-VAL-02'],
    body: {} },

  // 11. Audit Logs
  { folder: '11. Audit Logs', name: 'List Audit Logs', method: 'POST', path: '/audit-logs/list', roles: ['BIDAN'], auth: true, fsd: 'Bagian 1.6 / Audit Logs', errors: ['ERR-AUTH-03','ERR-VAL-01','ERR-VAL-03'],
    body: { entitas: 'pasien', aksi: 'VIEW_RME', tanggal_dari: '2026-11-01', tanggal_sampai: '2026-11-30', page: 1, per_page: 10 } },
];

const foldersOrder = [
  '1. Auth',
  '2. Public',
  '3. Pendaftaran & Antrean',
  '4. RME & Keselamatan Pasien',
  '5. Keuangan & Tagihan',
  '6. Inventaris',
  '7. Harga',
  '8. Laporan Analitik',
  '9. Konten Publik',
  '10. Notifikasi',
  '11. Audit Logs',
];

function buildCollection() {
  const folderMap = new Map(foldersOrder.map((name) => [name, { name, item: [] }]));
  for (const s of spec) {
    if (!folderMap.has(s.folder)) throw new Error(`Unknown folder: ${s.folder}`);
    const description = desc(s.name, s.roles, s.fsd, s.errors);
    folderMap.get(s.folder).item.push(req({ ...s, description }));
  }
  return {
    info: {
      name: 'Praktik Mandiri Bidan API',
      schema: SCHEMA,
      description: 'Generated collection (51 requests, 11 folders). Generate via: node backend/docs/postman/generate-postman.mjs',
    },
    item: foldersOrder.map((f) => folderMap.get(f)),
    variable: [{ key: 'baseUrl', value: 'http://localhost:3000' }, { key: 'token', value: '' }],
  };
}

function buildEnvironment() {
  const vars = [
    'baseUrl', 'token', 'user_id', 'pasien_id', 'sesi_id', 'reservasi_id', 'kunjungan_id', 'tagihan_id', 'item_id',
  ];
  const values = vars.map((key) => ({
    key,
    value: key === 'baseUrl' ? 'http://localhost:3000' : '',
    type: 'default',
    enabled: true,
  }));
  values.push({ key: 'username_bidan', value: 'bidan', type: 'default', enabled: true });
  values.push({ key: 'password_bidan', value: 'Bidan#2026', type: 'secret', enabled: true });
  values.push({ key: 'username_admin', value: 'admin', type: 'default', enabled: true });
  values.push({ key: 'password_admin', value: 'Admin#2026', type: 'secret', enabled: true });
  return { name: 'Local Dev', values, _postman_variable_scope: 'environment', _postman_exported_using: 'generate-postman.mjs' };
}

function main() {
  const collection = buildCollection();
  const environment = buildEnvironment();
  const collPath = path.join(__dirname, 'Praktik_Mandiri_Bidan_API.postman_collection.json');
  const envPath = path.join(__dirname, 'Local_Dev.postman_environment.json');
  fs.writeFileSync(collPath, JSON.stringify(collection, null, 2) + '\n');
  fs.writeFileSync(envPath, JSON.stringify(environment, null, 2) + '\n');
  console.log(`Wrote ${collPath}`);
  console.log(`Wrote ${envPath}`);
  console.log(`Requests: ${spec.length}, Folders: ${foldersOrder.length}`);
}

main();
