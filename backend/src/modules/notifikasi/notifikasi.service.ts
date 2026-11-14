import type { ConnectionPool } from 'mssql';
import { getPool } from '@/utils/db';
import { sendWa } from '@/utils/wa';
import * as repository from './notifikasi.repository';
import type { NotificationStatus, NotificationType } from './notifikasi.repository';

interface QueueParams {
  reservasiId: string;
  noTelepon: string | null;
  pesan: string;
}

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
