import type { ConnectionPool } from 'mssql';
import type { AuthUser, PaginationMeta } from '@/types/api';
import { AppError } from '@/utils/errors';
import { buildMeta, parsePagination } from '@/utils/pagination';
import type { TambahAlergiInput, UpdateAlergiInput } from './rme.validators';
import * as repo from './rme.repository';
import type {
  AlergiRow,
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
