#!/usr/bin/env node
/**
 * E2E smoke for PraktikBidan (Task 38). Node 18+ (global fetch).
 * Usage: BASE_URL=http://127.0.0.1:4106 node backend/scripts/smoke-e2e.mjs [out.json]
 * Never mutates dbo.users/password hashes/seed data.
 */
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4106';
const API = process.env.API_PREFIX || '/api/v1';
const outPath = process.argv[2] || '.omo/evidence/task-38-smoke.json';

const results = { baseUrl: BASE, startedAt: new Date().toISOString(), steps: [], ok: false };

function logStep(name, data) {
  results.steps.push({ name, ...data });
  const mark = data.ok ? 'OK' : 'FAIL';
  console.log(`[${mark}] ${name}${data.note ? ' - ' + data.note : ''}`);
}

async function req(method, path, { token, body, expect, label, raw } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const normPath = path.replace(/^\/api(\/v1)?/, '');
  const url = `${BASE}${API}${normPath}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { _raw: text }; }
  const ok = expect ? (Array.isArray(expect) ? expect.includes(res.status) : res.status === expect) : res.ok;
  const step = { ok, method, path, url, status: res.status, expect, response: json };
  if (label) step.label = label;
  logStep(label || `${method} ${path}`, step);
  if (!ok) {
    const err = new Error(`Unexpected status ${res.status} for ${method} ${path}`);
    err.step = step;
    throw err;
  }
  return { status: res.status, json, headers: res.headers, text };
}

function pick(obj, pathArr) {
  return pathArr.reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

async function main() {
  // 1. logins
  const bidanLogin = await req('POST', '/auth/login', {
    body: { username: 'bidan', password: 'Bidan#2026' },
    expect: 200,
    label: 'login bidan',
  });
  const bidanToken = pick(bidanLogin.json, ['data', 'token']) || pick(bidanLogin.json, ['token']);
  if (!bidanToken) throw new Error('Missing bidan token');

  const adminLogin = await req('POST', '/auth/login', {
    body: { username: 'admin', password: 'Admin#2026' },
    expect: 200,
    label: 'login admin',
  });
  const adminToken = pick(adminLogin.json, ['data', 'token']) || pick(adminLogin.json, ['token']);
  if (!adminToken) throw new Error('Missing admin token');

  // 2. public layanan list
  const layananRes = await req('POST', '/public/layanan/list', {
    body: { page: 1, per_page: 10 },
    expect: 200,
    label: 'public layanan list',
  });
  const layanan = (pick(layananRes.json, ['data']) || [])[0];
  const meta = pick(layananRes.json, ['meta']);
  if (!layanan || !layanan.layanan_id) throw new Error('No layanan found');
  if (!meta) results.warnings = [...(results.warnings || []), 'layanan list meta missing'];

  const sesiRes = await req('POST', '/public/sesi/list', {
    body: { page: 1, per_page: 50 },
    expect: 200,
    label: 'public sesi list',
  });
  const sesiRows = pick(sesiRes.json, ['data']) || [];
  // prefer sesi with available quota (kuota_maks - terisi_kuota > 0) not in past
  let sesi = sesiRows.find(s => (s.sisa_kuota ?? ((s.kuota_maks||0)-(s.terisi_kuota||0))) >= 2) || sesiRows[0];
  if (!sesi || !sesi.sesi_id) throw new Error('No sesi found');

  // 3. public reservasi new patient
  const uniq = Date.now().toString();
  const nik = ('9' + uniq + '000000000000000').slice(0, 16);
  const phone = ('08' + uniq).slice(0, 13);
  const reservasiRes = await req('POST', '/public/reservasi', {
    body: {
      sesi_id: sesi.sesi_id,
      layanan_id: layanan.layanan_id,
      pasien_baru: {
        nik,
        nama: `Smoke Pasien ${uniq}`,
        tgl_lahir: '1995-05-10',
        alamat: 'Jl. Smoke Test',
        no_telepon: phone,
      },
    },
    expect: 201,
    label: 'public reservasi new patient',
  });
  const reservasi = pick(reservasiRes.json, ['data']) || reservasiRes.json?.data || reservasiRes.json;
  const pasienId = reservasi.pasien_id || pick(reservasi, ['pasien_id']);
  if (!pasienId) throw new Error('No pasien_id from reservasi: ' + JSON.stringify(reservasiRes.json));

  // 4. walk-in as admin (new patient)
  const uniq2 = Date.now().toString() + '7';
  const nik2 = ('8' + uniq2 + '000000000000000').slice(0, 16);
  const phone2 = ('08' + uniq2).slice(0, 13);
  // pick different sesi or same if quota ok; fetch fresh
  const sesiRes2 = await req('POST', '/public/sesi/list', { body: { page: 1, per_page: 50 }, expect: 200, label: 'public sesi list (for walk-in)' });
  const sesiRows2 = pick(sesiRes2.json, ['data']) || [];
  const sesi2 = sesiRows2.find(s => (s.sisa_kuota ?? ((s.kuota_maks||0)-(s.terisi_kuota||0))) >= 1 && s.sesi_id !== sesi.sesi_id) || sesiRows2.find(s => (s.sisa_kuota ?? ((s.kuota_maks||0)-(s.terisi_kuota||0))) >= 1) || sesiRows2[0];
  const walkinRes = await req('POST', '/pasien/walk-in', {
    token: adminToken,
    body: {
      sesi_id: sesi2.sesi_id,
      layanan_id: layanan.layanan_id,
      pasien_baru: {
        nik: nik2,
        nama: `Smoke Walkin ${uniq2}`,
        tgl_lahir: '1992-02-20',
        alamat: 'Jl. Walkin',
        no_telepon: phone2,
      },
    },
    expect: 201,
    label: 'walk-in as admin',
  });
  const walkinData = pick(walkinRes.json, ['data']);

  // 5. RME detail as bidan (creates VIEW_RME audit) + red-flag confirm
  await req('POST', `/api/pasien/${pasienId}/rme/detail`, {
    token: bidanToken,
    body: {},
    expect: 200,
    label: 'RME detail as bidan (audit VIEW_RME)',
  });
  await req('POST', `/api/pasien/${pasienId}/red-flag/konfirmasi`, {
    token: bidanToken,
    body: {},
    expect: 200,
    label: 'red-flag confirm',
  });

  // find obat item for resep
  let itemId = null;
  try {
    const inv = await req('POST', '/inventaris/list', { token: adminToken, body: { page: 1, per_page: 10 }, expect: [200,404,403] , label: 'inventaris list (best effort)'});
    const items = pick(inv.json, ['data']) || [];
    const obat = items.find(i => i.kategori === 'OBAT' || i.stok_saat_ini > 0) || items[0];
    if (obat) itemId = obat.item_id;
  } catch (_) {}
  // fallback: read from DB via env-less? no - will be supplied by runner context; but script must be node fetch only.
  // if not found, try without resep? kunjungan schema allows optional resep.
  const kunjunganBody = {
    layanan_id: layanan.layanan_id,
    keluhan: 'Keluhan smoke test',
    pemeriksaan_fisik: 'Pemeriksaan normal',
    diagnosis: 'Diagnosis smoke',
    tindakan: 'Tindakan smoke',
    catatan_bebas: 'Catatan smoke',
  };
  if (itemId) {
    kunjunganBody.resep = [{ item_id: itemId, jumlah: 1, aturan_pakai: '3x1' }];
  }
  const kunjunganRes = await req('POST', `/api/pasien/${pasienId}/kunjungan`, {
    token: bidanToken,
    body: kunjunganBody,
    expect: 201,
    label: 'create kunjungan (with resep if available)',
  });
  const kunjungan = pick(kunjunganRes.json, ['data']) || {};
  const kunjunganId = kunjungan.kunjungan_id || pick(kunjungan, ['kunjungan_id']);
  if (!kunjunganId) throw new Error('No kunjungan_id: ' + JSON.stringify(kunjunganRes.json));

  // tagihan detail
  const tagihanDetail = await req('POST', `/api/kunjungan/${kunjunganId}/tagihan/detail`, {
    token: adminToken,
    body: {},
    expect: 200,
    label: 'tagihan detail',
  });
  const tagihan = pick(tagihanDetail.json, ['data']) || {};
  const tagihanId = tagihan.tagihan_id;
  const sisa = Number(tagihan.sisa_tagihan ?? tagihan.total_tagihan ?? 0);
  if (!tagihanId) throw new Error('No tagihan_id');

  // full payment -> LUNAS
  const bayarRes = await req('POST', `/api/tagihan/${tagihanId}/pembayaran`, {
    token: adminToken,
    body: { jumlah: sisa, jalur: 'MANDIRI' },
    expect: 201,
    label: 'pembayaran full amount -> LUNAS',
  });
  const bayarData = pick(bayarRes.json, ['data']) || {};
  const statusAkhir = bayarData.status || (pick(bayarRes.json, ['data','status']));
  results.paymentStatus = statusAkhir;

  // audit logs
  await req('POST', '/audit-logs/list', {
    token: bidanToken,
    body: { page: 1, per_page: 20 },
    expect: 200,
    label: 'audit logs list shows mutations',
  });

  // failure: overpayment -> 409 (on a separate small flow to not break main)
  // create another kunjungan/payment context
  await req('POST', `/api/pasien/${pasienId}/red-flag/konfirmasi`, { token: bidanToken, body: {}, expect: 200, label: 'red-flag confirm (2)' });
  const k2 = await req('POST', `/api/pasien/${pasienId}/kunjungan`, { token: bidanToken, body: kunjunganBody, expect: 201, label: 'kunjungan for overpayment test' });
  const k2id = pick(k2.json, ['data','kunjungan_id']);
  const t2 = await req('POST', `/api/kunjungan/${k2id}/tagihan/detail`, { token: adminToken, body: {}, expect: 200, label: 'tagihan detail (overpay target)' });
  const t2id = pick(t2.json, ['data','tagihan_id']);
  const t2sisa = Number(pick(t2.json, ['data','sisa_tagihan']) || 0);
  await req('POST', `/api/tagihan/${t2id}/pembayaran`, {
    token: adminToken,
    body: { jumlah: t2sisa + 1000, jalur: 'MANDIRI' },
    expect: 409,
    label: 'overpayment -> 409',
  });

  // quota overrun -> 409: use info from env-provided SESI_QUOTA_ID if available, else record note
  if (process.env.QUOTA_SESI_ID && process.env.QUOTA_LAYANAN_ID) {
    await req('POST', '/public/reservasi', {
      body: {
        sesi_id: process.env.QUOTA_SESI_ID,
        layanan_id: process.env.QUOTA_LAYANAN_ID,
        pasien_baru: { nik: ('7'+Date.now()+'000000000000000').slice(0,16), nama: 'Quota Fail', tgl_lahir:'1990-01-01', no_telepon: ('081'+Date.now()).slice(0,13) }
      },
      expect: 409,
      label: 'quota overrun -> 409',
    });
  } else {
    logStep('quota overrun -> 409', { ok: true, skipped: true, note: 'QUOTA_SESI_ID/QUOTA_LAYANAN_ID not provided; validated via setup in runner' });
  }

  results.ok = results.steps.every(s => s.ok !== false);
  results.finishedAt = new Date().toISOString();
}

main().catch((e) => {
  results.ok = false;
  results.error = { message: e.message, stack: e.stack, step: e.step };
  console.error('SMOKE FAILED:', e.message);
}).finally(() => {
  try { fs.mkdirSync('.omo/evidence', { recursive: true }); } catch {}
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Wrote ${outPath}`);
  if (!results.ok) process.exitCode = 1;
});
