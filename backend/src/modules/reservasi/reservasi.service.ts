import type { ConnectionPool } from 'mssql';
import type { AuthUser } from '@/types/api';
import { todayJakarta } from '@/utils/date';
import { AppError } from '@/utils/errors';
import * as notifikasi from '@/modules/notifikasi/notifikasi.service';
import * as repository from './reservasi.repository';
import type { ReservasiRow, ReservasiStatus } from './reservasi.repository';
import type {
  BatalReservasiInput,
  BuatReservasiInput,
  ListReservasiFilters,
  RescheduleReservasiInput,
  UpdateStatusReservasiInput,
} from './reservasi.validators';

const ALLOWED_TRANSITIONS: Record<ReservasiStatus, ReservasiStatus[]> = {
  MENUNGGU: ['DIPANGGIL'],
  DIPANGGIL: ['SELESAI', 'MENUNGGU'],
  SELESAI: [],
  DIBATALKAN: [],
};

function confirmationMessage(row: ReservasiRow): string {
  return [
    'Reservasi praktik Bidan berhasil.',
    `Nomor antrean: ${row.nomor_antrean}`,
    `Tanggal: ${row.tanggal}`,
    `Estimasi jam: ${row.estimasi_jam}`,
    `Layanan: ${row.nama_layanan}`,
    'Mohon datang 10 menit sebelum jadwal.',
  ].join('\n');
}

function changeMessage(row: ReservasiRow): string {
  return [
    'Reservasi praktik Bidan diperbarui.',
    `Status: ${row.status}`,
    `Nomor antrean: ${row.nomor_antrean}`,
    `Tanggal: ${row.tanggal}`,
    `Estimasi jam: ${row.estimasi_jam}`,
    `Layanan: ${row.nama_layanan}`,
  ].join('\n');
}

async function create(
  db: ConnectionPool,
  input: BuatReservasiInput,
  metode: 'ONLINE' | 'MANUAL_ADMIN',
  dibuatOleh: string | null,
  ip: string | null,
): Promise<ReservasiRow> {
  const created = await repository.createViaSp(db, {
    pasienId: input.pasien_id ?? null,
    nik: input.pasien_baru?.nik ?? null,
    nama: input.pasien_baru?.nama ?? null,
    tglLahir: input.pasien_baru?.tgl_lahir ?? null,
    alamat: input.pasien_baru?.alamat ?? null,
    noTelepon: input.pasien_baru?.no_telepon ?? null,
    sesiId: input.sesi_id,
    layananId: input.layanan_id,
    metodeDaftar: metode,
    dibuatOleh,
    ip,
  });

  const row = await repository.findById(db, created.reservasi_id);
  if (!row) throw new AppError('ERR-SYS-02');

  if (metode === 'ONLINE') {
    await notifikasi.queueReservationConfirmation(db, {
      reservasiId: row.reservasi_id,
      noTelepon: row.no_telepon,
      pesan: confirmationMessage(row),
    });
  }

  return row;
}

export function buatReservasi(
  db: ConnectionPool,
  input: BuatReservasiInput,
  ip: string | null,
): Promise<ReservasiRow> {
  return create(db, input, 'ONLINE', null, ip);
}

export function walkIn(
  db: ConnectionPool,
  input: BuatReservasiInput,
  user: AuthUser,
  ip: string | null,
): Promise<ReservasiRow> {
  return create(db, input, 'MANUAL_ADMIN', user.user_id, ip);
}

export async function listReservasi(
  db: ConnectionPool,
  filters: ListReservasiFilters,
  page: number,
  perPage: number,
): Promise<{ rows: ReservasiRow[]; total: number }> {
  return repository.list(db, filters, page, perPage, todayJakarta());
}

export async function rescheduleReservasi(
  db: ConnectionPool,
  reservasiId: string,
  input: RescheduleReservasiInput,
  user: AuthUser,
  ip: string | null,
): Promise<ReservasiRow> {
  await repository.rescheduleViaSp(db, {
    reservasiId,
    sesiBaruId: input.sesi_id_baru,
    alasan: input.alasan,
    userId: user.user_id,
    ip,
  });

  const row = await repository.findById(db, reservasiId);
  if (!row) throw new AppError('ERR-RSV-03');

  await notifikasi.queueReservationChange(db, {
    reservasiId: row.reservasi_id,
    noTelepon: row.no_telepon,
    pesan: changeMessage(row),
  });

  return row;
}

export async function batalReservasi(
  db: ConnectionPool,
  reservasiId: string,
  input: BatalReservasiInput,
  user: AuthUser,
  ip: string | null,
): Promise<ReservasiRow> {
  await repository.rescheduleViaSp(db, {
    reservasiId,
    sesiBaruId: null,
    alasan: input.alasan,
    userId: user.user_id,
    ip,
  });

  const row = await repository.findById(db, reservasiId);
  if (!row) throw new AppError('ERR-RSV-03');

  await notifikasi.queueReservationChange(db, {
    reservasiId: row.reservasi_id,
    noTelepon: row.no_telepon,
    pesan: changeMessage(row),
  });

  return row;
}

export async function updateStatusReservasi(
  db: ConnectionPool,
  reservasiId: string,
  input: UpdateStatusReservasiInput,
): Promise<ReservasiRow> {
  const current = await repository.findById(db, reservasiId);
  if (!current) throw new AppError('ERR-RSV-03');

  if (current.status === input.status) return current;

  const allowed = ALLOWED_TRANSITIONS[current.status];
  if (!allowed.includes(input.status as ReservasiStatus)) {
    throw new AppError('ERR-RSV-04');
  }

  const updated = await repository.updateStatus(db, reservasiId, input.status);
  if (!updated) throw new AppError('ERR-RSV-03');
  return updated;
}
