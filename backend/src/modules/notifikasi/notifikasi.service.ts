import type { ConnectionPool } from 'mssql';
import { getPool } from '@/utils/db';
import { AppError } from '@/utils/errors';
import { sendWa } from '@/utils/wa';
import * as repository from './notifikasi.repository';
import type {
  ListNotifikasiFilter,
  NotificationStatus,
  NotificationType,
  NotifikasiLogRow,
} from './notifikasi.repository';

interface QueueParams {
  reservasiId: string;
  noTelepon: string | null;
  pesan: string;
}

const RESENDABLE_JENIS: NotificationType[] = [
  'KONFIRMASI',
  'PENGINGAT_H1',
  'PERUBAHAN',
  'INVENTARIS',
];

async function queue(
  db: ConnectionPool,
  jenis: NotificationType,
  params: QueueParams,
): Promise<void> {
  let notifId: string;

  try {
    notifId = await repository.insertLog(db, {
      reservasiId: params.reservasiId,
      jenis,
      noTelepon: params.noTelepon,
      pesan: params.pesan,
    });
  } catch (error) {
    // A notification must never fail the reservation transaction.
    console.error('Gagal mencatat log notifikasi', error);
    return;
  }

  void deliver(notifId, params.noTelepon, params.pesan);
}

async function deliver(
  notifId: string,
  target: string | null,
  message: string,
): Promise<void> {
  let status: NotificationStatus = 'GAGAL';

  if (target) {
    try {
      await sendWa(target, message);
      status = 'TERKIRIM';
    } catch (error) {
      console.error('Gagal mengirim WhatsApp', error);
    }
  }

  try {
    const pool = await getPool();
    await repository.updateStatus(pool, notifId, status);
  } catch (error) {
    console.error('Gagal memperbarui status notifikasi', error);
  }
}

export function queueReservationConfirmation(
  db: ConnectionPool,
  params: QueueParams,
): Promise<void> {
  return queue(db, 'KONFIRMASI', params);
}

export function queueReservationChange(
  db: ConnectionPool,
  params: QueueParams,
): Promise<void> {
  return queue(db, 'PERUBAHAN', params);
}

export function listLogs(
  db: ConnectionPool,
  filter: ListNotifikasiFilter,
  page: number,
  perPage: number,
): Promise<{ rows: NotifikasiLogRow[]; total: number }> {
  return repository.listLogs(db, filter, page, perPage);
}

export async function resend(
  db: ConnectionPool,
  notifId: string,
): Promise<NotifikasiLogRow> {
  const log = await repository.findLogById(db, notifId);
  if (!log) throw new AppError('ERR-NTF-01', 'Log notifikasi tidak ditemukan', undefined, 404);

  if (log.jenis === 'OTP') {
    throw new AppError('ERR-NTF-01', 'Notifikasi OTP tidak dapat dikirim ulang', undefined, 422);
  }

  if (!RESENDABLE_JENIS.includes(log.jenis)) {
    throw new AppError('ERR-NTF-01', 'Jenis notifikasi tidak dapat dikirim ulang', undefined, 422);
  }

  if (log.retry_count >= 3) {
    throw new AppError('ERR-NTF-01', 'Batas percobaan kirim ulang habis', undefined, 502);
  }

  let status: NotificationStatus = 'GAGAL';
  if (log.no_telepon && log.pesan) {
    try {
      await sendWa(log.no_telepon, log.pesan);
      status = 'TERKIRIM';
    } catch {
      status = 'GAGAL';
    }
  }

  const updated = await repository.recordRetry(db, notifId, status);
  if (!updated) throw new AppError('ERR-NTF-01', 'Log notifikasi tidak ditemukan', undefined, 404);
  return updated;
}
