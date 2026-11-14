import sql from 'mssql';

type Db = sql.ConnectionPool;

export type NotificationType =
  | 'KONFIRMASI'
  | 'PENGINGAT_H1'
  | 'PERUBAHAN'
  | 'INVENTARIS'
  | 'OTP';

export type NotificationStatus = 'TERKIRIM' | 'GAGAL';

export interface InsertNotificationParams {
  reservasiId: string | null;
  jenis: NotificationType;
  noTelepon: string | null;
  pesan: string;
}

export async function insertLog(
  db: Db,
  params: InsertNotificationParams,
): Promise<string> {
  const result = await db
    .request()
    .input('reservasi_id', sql.UniqueIdentifier, params.reservasiId)
    .input('jenis', sql.VarChar(20), params.jenis)
    .input('no_telepon', sql.NVarChar(20), params.noTelepon)
    .input('pesan', sql.NVarChar(sql.MAX), params.pesan)
    .query<{ notif_id: string }>(`
      INSERT INTO dbo.log_notifikasi
        (reservasi_id, jenis, no_telepon, pesan, status)
      OUTPUT INSERTED.notif_id
      VALUES
        (@reservasi_id, @jenis, @no_telepon, @pesan, 'GAGAL')
    `);

  return result.recordset[0].notif_id;
}

export async function updateStatus(
  db: Db,
  notifId: string,
  status: NotificationStatus,
): Promise<void> {
  await db
    .request()
    .input('notif_id', sql.UniqueIdentifier, notifId)
    .input('status', sql.VarChar(20), status)
    .query(`
      UPDATE dbo.log_notifikasi
      SET status = @status,
          waktu_kirim = CASE
            WHEN @status = 'TERKIRIM' THEN SYSDATETIME()
            ELSE waktu_kirim
          END
      WHERE notif_id = @notif_id
    `);
}
