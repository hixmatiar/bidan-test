import type { ConnectionPool } from 'mssql';
import * as repo from './laporan.repository';
import type {
  ExportInput,
  PerbandinganInput,
  TrenLayananInput,
} from './laporan.validators';

export async function ringkasan(db: ConnectionPool, input: { dari: string; sampai: string }) {
  const row = await repo.ringkasan(db, input.dari, input.sampai);
  return {
    periode: { dari: input.dari, sampai: input.sampai },
    jumlah_kunjungan: Number(row.jumlah_kunjungan ?? 0),
    pasien_baru: Number(row.pasien_baru ?? 0),
    jumlah_reservasi: Number(row.jumlah_reservasi ?? 0),
    total_pendapatan: Number(row.total_pendapatan ?? 0),
    tagihan_belum_lunas: Number(row.tagihan_belum_lunas ?? 0),
  };
}

export async function trenLayanan(db: ConnectionPool, input: TrenLayananInput) {
  const [rows, diagnoses] = await Promise.all([
    repo.trenLayanan(db, input.dari, input.sampai, input.grup),
    repo.topDiagnosis(db, input.dari, input.sampai),
  ]);
  return {
    periode: { dari: input.dari, sampai: input.sampai, grup: input.grup },
    tren: rows.map((r) => ({
      periode: r.periode,
      layanan_id: r.layanan_id,
      nama_layanan: r.nama_layanan,
      jumlah_kunjungan: Number(r.jumlah_kunjungan),
    })),
    top_diagnosis: diagnoses.map((d) => ({
      diagnosis: d.diagnosis,
      jumlah: Number(d.jumlah),
    })),
  };
}

export async function jamTersibuk(db: ConnectionPool) {
  const rows = await repo.jamTersibuk(db);
  const map = new Map<number, number>();
  for (const r of rows) {
    if (r.jam != null) map.set(Number(r.jam), Number(r.jumlah_reservasi));
  }
  const buckets = Array.from({ length: 24 }, (_, jam) => ({
    jam,
    jumlah_reservasi: map.get(jam) ?? 0,
  }));
  return { buckets };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function perbandingan(db: ConnectionPool, input: PerbandinganInput) {
  const [aRows, bRows] = await Promise.all([
    repo.perbandinganPerLayanan(db, input.periode_a.dari, input.periode_a.sampai),
    repo.perbandinganPerLayanan(db, input.periode_b.dari, input.periode_b.sampai),
  ]);
  const aMap = new Map(aRows.map((r) => [r.layanan_id, r]));
  const bMap = new Map(bRows.map((r) => [r.layanan_id, r]));
  const ids = Array.from(new Set([...aMap.keys(), ...bMap.keys()]));

  const perLayanan = ids.map((id) => {
    const a = aMap.get(id);
    const b = bMap.get(id);
    const V0 = Number(a?.qty ?? 0);
    const V1 = Number(b?.qty ?? 0);
    const rev0 = Number(a?.revenue ?? 0);
    const rev1 = Number(b?.revenue ?? 0);
    const P0 = V0 === 0 ? 0 : rev0 / V0;
    const P1 = V1 === 0 ? 0 : rev1 / V1;
    const volume_effect = (V1 - V0) * P0;
    const price_effect = V0 * (P1 - P0);
    const interaction = (V1 - V0) * (P1 - P0);
    const delta = rev1 - rev0;
    return {
      layanan_id: id,
      nama_layanan: a?.nama_layanan ?? b?.nama_layanan ?? '',
      V0: round2(V0),
      P0: round2(P0),
      V1: round2(V1),
      P1: round2(P1),
      volume_effect: round2(volume_effect),
      price_effect: round2(price_effect),
      interaction: round2(interaction),
      delta: round2(delta),
    };
  });

  const totals = perLayanan.reduce(
    (acc, r) => {
      acc.volume_effect = round2(acc.volume_effect + r.volume_effect);
      acc.price_effect = round2(acc.price_effect + r.price_effect);
      acc.interaction = round2(acc.interaction + r.interaction);
      acc.delta = round2(acc.delta + r.delta);
      return acc;
    },
    { volume_effect: 0, price_effect: 0, interaction: 0, delta: 0 },
  );

  return {
    periode_a: input.periode_a,
    periode_b: input.periode_b,
    grup: input.grup,
    per_layanan: perLayanan,
    totals,
    meta: { formula: 'delta = volume_effect + price_effect + interaction' },
  };
}

export async function getExportData(db: ConnectionPool, input: ExportInput) {
  if (input.laporan === 'ringkasan') {
    return { laporan: input.laporan, data: await ringkasan(db, { dari: input.dari!, sampai: input.sampai! }) };
  }
  if (input.laporan === 'tren-layanan') {
    return {
      laporan: input.laporan,
      data: await trenLayanan(db, {
        dari: input.dari!,
        sampai: input.sampai!,
        grup: input.grup ?? 'BULANAN',
      }),
    };
  }
  if (input.laporan === 'jam-tersibuk') {
    return { laporan: input.laporan, data: await jamTersibuk(db) };
  }
  return {
    laporan: input.laporan,
    data: await perbandingan(db, {
      periode_a: input.periode_a!,
      periode_b: input.periode_b!,
      grup: 'LAYANAN',
    }),
  };
}
