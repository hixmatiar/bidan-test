import cron from 'node-cron';
import sql from 'mssql';
import { env } from '@/config/env';
import { todayJakarta } from '@/utils/date';
import { getPool } from '@/utils/db';
import { sendWa } from '@/utils/wa';
import { insertLog, updateStatus } from '@/modules/notifikasi/notifikasi.repository';

type ReminderRow = {
  reservasi_id: string;
  no_telepon: string | null;
  nomor_antrean: number;
  nama_pasien: string;
  nama_layanan: string;
  tanggal: string;
  estimasi_jam: string;
};

function reminderMessage(row: ReminderRow): string {
  return [
    'Pengingat reservasi praktik Bidan (H-1).',
    `Nama: ${row.nama_pasien}`,
    `Tanggal: ${row.tanggal}`,
    `Estimasi jam: ${row.estimasi_jam}`,
    `Nomor antrean: ${row.nomor_antrean}`,
    `Layanan: ${row.nama_layanan}`,
    'Mohon datang 10 menit sebelum jadwal.',
  ].join('\n');
}

export async function runReminderH1(): Promise<number> {
  const pool = await getPool();
  const today = todayJakarta();
  const result = await pool.request().input('today', sql.Date, today).query<ReminderRow>(`
    SELECT
      r.reservasi_id,
      p.no_telepon,
      r.nomor_antrean,
      p.nama AS nama_pasien,
      l.nama AS nama_layanan,
      CONVERT(char(10), s.tanggal, 23) AS tanggal,
      CONVERT(char(8), r.estimasi_jam, 108) AS estimasi_jam
    FROM dbo.reservasi r
    INNER JOIN dbo.sesi_praktik s ON s.sesi_id = r.sesi_id
    INNER JOIN dbo.pasien p ON p.pasien_id = r.pasien_id
    INNER JOIN dbo.layanan l ON l.layanan_id = r.layanan_id
    WHERE r.status = 'MENUNGGU'
      AND s.tanggal = DATEADD(DAY, 1, @today)
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.log_notifikasi n
        WHERE n.reservasi_id = r.reservasi_id
          AND n.jenis = 'PENGINGAT_H1'
          AND CAST(n.created_at AS DATE) = @today
      )
  `);

  let count = 0;
  for (const row of result.recordset) {
    const pesan = reminderMessage(row);
    let notifId: string;
    try {
      notifId = await insertLog(pool, {
        reservasiId: row.reservasi_id,
        jenis: 'PENGINGAT_H1',
        noTelepon: row.no_telepon,
        pesan,
      });
    } catch (error) {
      console.error('[jobs] gagal mencatat log PENGINGAT_H1', error);
      continue;
    }

    let status: 'TERKIRIM' | 'GAGAL' = 'GAGAL';
    if (row.no_telepon) {
      try {
        await sendWa(row.no_telepon, pesan);
        status = 'TERKIRIM';
      } catch (error) {
        console.error('[jobs] gagal kirim PENGINGAT_H1', error);
      }
    }

    try {
      await updateStatus(pool, notifId, status);
    } catch (error) {
      console.error('[jobs] gagal update status PENGINGAT_H1', error);
    }
    count += 1;
  }

  console.log(`[jobs] reminder H-1 selesai, diproses=${count}`);
  return count;
}

export function scheduleReminderH1(): cron.ScheduledTask | null {
  if (!cron.validate(env.CRON_REMINDER_H1)) {
    console.error(`[jobs] CRON_REMINDER_H1 tidak valid: ${env.CRON_REMINDER_H1}`);
    return null;
  }
  const task = cron.schedule(
    env.CRON_REMINDER_H1,
    () => {
      void runReminderH1().catch((error) => {
        console.error('[jobs] reminder H-1 error', error);
      });
    },
    { timezone: 'Asia/Jakarta' },
  );
  console.log(`[jobs] reminder H-1 terjadwal: ${env.CRON_REMINDER_H1} (Asia/Jakarta)`);
  return task;
}
