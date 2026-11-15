import cron from 'node-cron';
import sql from 'mssql';
import { env } from '@/config/env';
import { todayJakarta } from '@/utils/date';
import { getPool } from '@/utils/db';
import { sendWa } from '@/utils/wa';
import { insertLog, updateStatus } from '@/modules/notifikasi/notifikasi.repository';

type AdminRow = { no_telepon: string | null };
type AlertRow = {
  nama: string;
  satuan: string;
  stok: number;
  stok_minimum: number;
  tgl_kedaluwarsa: Date | string | null;
  status_stok: string;
};

async function getAdminPhone(pool: sql.ConnectionPool): Promise<string | null> {
  const result = await pool.request().query<AdminRow>(`
    SELECT TOP 1 no_telepon
    FROM dbo.users
    WHERE role = 'ADMIN' AND is_active = 1 AND no_telepon IS NOT NULL
    ORDER BY created_at ASC
  `);
  return result.recordset[0]?.no_telepon ?? null;
}

function formatDate(value: Date | string | null): string {
  if (!value) return '-';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function buildMessage(rows: AlertRow[], tanggal: string): string {
  if (rows.length === 0) {
    return `Ringkasan inventaris (${tanggal}): tidak ada item HABIS/MENIPIS/KEDALUWARSA.`;
  }
  const lines = [`Ringkasan inventaris (${tanggal}):`];
  for (const row of rows) {
    lines.push(
      `- ${row.nama}: ${row.status_stok}, stok ${row.stok} ${row.satuan}, minimum ${row.stok_minimum}, kedaluwarsa ${formatDate(row.tgl_kedaluwarsa)}`,
    );
  }
  return lines.join('\n');
}

export async function runInventoryWeekly(): Promise<string> {
  const pool = await getPool();
  const tanggal = todayJakarta();
  const alertResult = await pool.request().query<AlertRow>(`
    SELECT nama, satuan, stok, stok_minimum, tgl_kedaluwarsa, status_stok
    FROM dbo.v_inventaris_status
    WHERE status_stok IN ('HABIS', 'MENIPIS', 'KEDALUWARSA')
    ORDER BY CASE status_stok WHEN 'HABIS' THEN 1 WHEN 'KEDALUWARSA' THEN 2 WHEN 'MENIPIS' THEN 3 ELSE 4 END, nama ASC
  `);
  const rows = alertResult.recordset;
  const pesan = buildMessage(rows, tanggal);
  const adminPhone = await getAdminPhone(pool);

  const notifId = await insertLog(pool, {
    reservasiId: null,
    jenis: 'INVENTARIS',
    noTelepon: adminPhone,
    pesan,
  });

  let status: 'TERKIRIM' | 'GAGAL' = 'GAGAL';
  if (adminPhone) {
    try {
      await sendWa(adminPhone, pesan);
      status = 'TERKIRIM';
    } catch (error) {
      console.error('[jobs] gagal kirim ringkasan inventaris', error);
    }
  }

  try {
    await updateStatus(pool, notifId, status);
  } catch (error) {
    console.error('[jobs] gagal update status inventaris', error);
  }

  console.log(`[jobs] ringkasan inventaris selesai, items=${rows.length}, status=${status}`);
  return notifId;
}

export function scheduleInventoryWeekly(): cron.ScheduledTask | null {
  if (!cron.validate(env.CRON_INVENTORY_WEEKLY)) {
    console.error(`[jobs] CRON_INVENTORY_WEEKLY tidak valid: ${env.CRON_INVENTORY_WEEKLY}`);
    return null;
  }
  const task = cron.schedule(
    env.CRON_INVENTORY_WEEKLY,
    () => {
      void runInventoryWeekly().catch((error) => {
        console.error('[jobs] inventaris mingguan error', error);
      });
    },
    { timezone: 'Asia/Jakarta' },
  );
  console.log(`[jobs] inventaris mingguan terjadwal: ${env.CRON_INVENTORY_WEEKLY} (Asia/Jakarta)`);
  return task;
}
