import type { ConnectionPool } from 'mssql';
import type { AuthUser, PaginationMeta } from '@/types/api';
import { dateTimeWib, todayJakarta } from '@/utils/date';
import { AppError } from '@/utils/errors';
import { buildMeta, parsePagination } from '@/utils/pagination';
import type {
  BuatKunjunganInput,
  CatatanKunjunganInput,
  TambahAlergiInput,
  UpdateAlergiInput,
} from './rme.validators';
import * as repo from './rme.repository';
import type {
  AlergiRow,
  CatatanKunjunganRow,
  CreatedKunjungan,
  KunjunganDenganResep,
  PasienListRow,
  ProfilRmeRow,
} from './rme.repository';

type Db = ConnectionPool;

const RED_FLAG_CATEGORIES = new Set(['ALERGI_OBAT', 'KEHAMILAN_RISTI']);

function isRedFlag(alergi: AlergiRow): boolean {
  return RED_FLAG_CATEGORIES.has(alergi.kategori);
}

function parseQ(body: unknown): string | null {
  const raw = (body ?? {}) as Record<string, unknown>;
  const q = raw.q;

  if (q === undefined || q === null || q === '') return null;
  if (typeof q !== 'string') {
    throw new AppError('ERR-VAL-03', 'Nilai q harus berupa teks');
  }

  const trimmed = q.trim();
  if (trimmed.length > 100) {
    throw new AppError('ERR-VAL-03', 'Nilai q maksimal 100 karakter');
  }

  return trimmed.length > 0 ? trimmed : null;
}

export async function listPasien(
  db: Db,
  body: unknown,
): Promise<{ rows: PasienListRow[]; meta: PaginationMeta }> {
  const { current_page, per_page } = parsePagination(body);
  const q = parseQ(body);

  const result = await repo.listPasien(db, {
    q,
    page: current_page,
    perPage: per_page,
  });

  return {
    rows: result.rows.map((row) => ({
      ...row,
      has_red_flag: row.has_red_flag === true,
    })),
    meta: buildMeta(result.total, current_page, per_page),
  };
}

export async function rmeDetail(
  db: Db,
  user: AuthUser,
  pasienId: string,
  ip: string | null,
): Promise<{
  pasien: ProfilRmeRow;
  alergi_aktif: AlergiRow[];
  has_red_flag: boolean;
  kunjungan: KunjunganDenganResep[];
}> {
  const profil = await repo.findProfilRme(db, pasienId);

  if (!profil) {
    throw new AppError('ERR-RME-01');
  }

  const alergi = await repo.listAlergiAktif(db, pasienId);
  const kunjungan = await repo.listKunjunganDenganResep(db, pasienId);
  const redFlags = alergi.filter(isRedFlag);

  // Audit BEFORE the response leaves the process; a failed write fails the request.
  await repo.insertAuditViewRme(db, {
    pasienId,
    userId: user.user_id,
    username: user.username,
    ip,
  });

  return {
    pasien: { ...profil, jumlah_red_flag_aktif: redFlags.length },
    alergi_aktif: alergi,
    has_red_flag: redFlags.length > 0,
    kunjungan,
  };
}

export async function tambahAlergi(
  db: Db,
  user: AuthUser,
  pasienId: string,
  input: TambahAlergiInput,
): Promise<AlergiRow> {
  if (!(await repo.pasienExists(db, pasienId))) {
    throw new AppError('ERR-RME-01');
  }

  if (input.kategori === 'ALERGI_OBAT' && input.item_id) {
    if (!(await repo.itemExists(db, input.item_id))) {
      throw new AppError('ERR-VAL-01', 'Validasi body gagal', [
        { path: 'item_id', message: 'Item inventaris tidak ditemukan' },
      ]);
    }
  }

  return repo.insertAlergi(db, {
    pasienId,
    kategori: input.kategori,
    nama: input.nama,
    itemId: input.item_id ?? null,
    keterangan: input.keterangan ?? null,
    dicatatOleh: user.user_id,
  });
}

export async function updateAlergi(
  db: Db,
  alergiId: string,
  input: UpdateAlergiInput,
): Promise<AlergiRow> {
  const updated = await repo.updateAlergi(db, alergiId, {
    isActive: input.is_active,
    keterangan: input.keterangan,
  });

  if (!updated) {
    // ponytail: no dedicated alergi-not-found code exists; ERR-RME-01 is the
    // closest documented 404 in the RME module. Swapping codes later is one line.
    throw new AppError('ERR-RME-01', 'Alergi atau kondisi tidak ditemukan');
  }

  return updated;
}

function parseKunjunganDate(value?: string): Date {
  if (!value) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+07:00`);
  }
  return new Date(value);
}

export async function buatKunjungan(
  db: Db,
  user: AuthUser,
  pasienId: string,
  input: BuatKunjunganInput,
): Promise<CreatedKunjungan> {
  const confirmed = await repo.hasRedFlagConfirmationToday(
    db,
    pasienId,
    user.user_id,
  );

  if (!confirmed) {
    throw new AppError('ERR-RME-03');
  }

  if (input.koreksi_dari_id) {
    const owned = await repo.kunjunganMilikPasien(
      db,
      input.koreksi_dari_id,
      pasienId,
    );
    if (!owned) {
      throw new AppError('ERR-VAL-01', 'Validasi body gagal', [
        {
          path: 'koreksi_dari_id',
          message: 'Kunjungan koreksi tidak ditemukan untuk pasien ini',
        },
      ]);
    }
  }

  return repo.createKunjunganViaSp(db, {
    pasienId,
    reservasiId: input.reservasi_id ?? null,
    bidanId: user.user_id,
    layananId: input.layanan_id,
    tanggalKunjungan: parseKunjunganDate(input.tanggal_kunjungan),
    keluhan: input.keluhan,
    pemeriksaanFisik: input.pemeriksaan_fisik,
    diagnosis: input.diagnosis,
    tindakan: input.tindakan,
    catatanBebas: input.catatan_bebas ?? null,
    koreksiDariId: input.koreksi_dari_id ?? null,
    resep: (input.resep ?? []).map((item) => ({
      itemId: item.item_id,
      jumlah: item.jumlah,
      aturanPakai: item.aturan_pakai ?? null,
    })),
  });
}

export async function tambahCatatan(
  db: Db,
  user: AuthUser,
  kunjunganId: string,
  input: CatatanKunjunganInput,
): Promise<CatatanKunjunganRow> {
  const appendText = `\n[${dateTimeWib()}][${user.username}] ${input.catatan}`;
  const row = await repo.appendCatatanKunjungan(db, kunjunganId, appendText);

  if (!row) {
    throw new AppError('ERR-RME-02');
  }

  return row;
}

export interface RmeExportData {
  pasien: ProfilRmeRow;
  alergi_aktif: AlergiRow[];
  kunjungan: KunjunganDenganResep[];
  filename: string;
  generated_at: string;
}

function safeFilenamePart(value: string): string {
  const cleaned = value
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned.length > 0 ? cleaned : 'pasien';
}

export async function siapkanEksporRme(
  db: Db,
  user: AuthUser,
  pasienId: string,
  ip: string | null,
): Promise<RmeExportData> {
  const profil = await repo.findProfilRme(db, pasienId);

  if (!profil) {
    throw new AppError('ERR-RME-01');
  }

  const alergi = await repo.listAlergiAktif(db, pasienId);
  const kunjungan = await repo.listKunjunganDenganResep(db, pasienId);

  await repo.insertAuditDataExported(db, {
    pasienId,
    userId: user.user_id,
    username: user.username,
    ip,
  });

  const tanggal = todayJakarta();

  return {
    pasien: profil,
    alergi_aktif: alergi,
    kunjungan,
    filename: `RME-${safeFilenamePart(profil.nama)}-${tanggal}.pdf`,
    generated_at: dateTimeWib(),
  };
}

export async function konfirmasiRedFlag(
  db: Db,
  user: AuthUser,
  pasienId: string,
  ip: string | null,
): Promise<{ confirmed: true; confirmed_at: string }> {
  if (!(await repo.pasienExists(db, pasienId))) {
    throw new AppError('ERR-RME-01');
  }

  const alergi = await repo.listAlergiAktif(db, pasienId);
  const snapshot = alergi.filter(isRedFlag);

  const confirmedAt = await repo.insertAuditRedFlagConfirmed(db, {
    pasienId,
    userId: user.user_id,
    username: user.username,
    ip,
    snapshotJson: JSON.stringify(snapshot),
  });

  return {
    confirmed: true,
    confirmed_at:
      confirmedAt instanceof Date
        ? confirmedAt.toISOString()
        : new Date(confirmedAt).toISOString(),
  };
}
