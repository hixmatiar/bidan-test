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

export interface NotifikasiLogRow {
  notif_id: string;
  reservasi_id: string | null;
  jenis: NotificationType;
  no_telepon: string | null;
  pesan: string | null;
  status: NotificationStatus;
  retry_count: number;
  waktu_kirim: Date | null;
  created_at: Date;
}

export interface ListNotifikasiFilter {
  jenis?: NotificationType;
  status?: NotificationStatus;
  tanggal_dari?: string;
  tanggal_sampai?: string;
}

interface Param {
  name: string;
  type: sql.ISqlType | (() => sql.ISqlType);
  value: unknown;
}

const COLUMNS =
  'notif_id, reservasi_id, jenis, no_telepon, pesan, status, retry_count, waktu_kirim, created_at';

const OUT_DECL = `
  DECLARE @out TABLE (
    notif_id UNIQUEIDENTIFIER, reservasi_id UNIQUEIDENTIFIER NULL, jenis VARCHAR(20),
    no_telepon NVARCHAR(20) NULL, pesan NVARCHAR(MAX) NULL, status VARCHAR(20),
    retry_count TINYINT, waktu_kirim DATETIME2(0) NULL, created_at DATETIME2(0)
  );`;

async function queryPage<T>(
  db: Db,
  countSql: string,
  listSql: string,
  params: Param[],
): Promise<{ total: number; rows: T[] }> {
  const request = db.request();
  for (const param of params) request.input(param.name, param.type, param.value);
  const { recordsets } = await request.query(`${countSql};\n${listSql};`);
  const sets = Array.isArray(recordsets) ? recordsets : Object.values(recordsets);
  const count = sets[0]?.[0] as { total: number } | undefined;
  return { total: count?.total ?? 0, rows: (sets[1] ?? []) as T[] };
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

export async function listLogs(
  db: Db,
  filter: ListNotifikasiFilter,
  page: number,
  perPage: number,
): Promise<{ rows: NotifikasiLogRow[]; total: number }> {
  const where: string[] = [];
  const params: Param[] = [
    { name: 'offset', type: sql.Int, value: (page - 1) * perPage },
    { name: 'limit', type: sql.Int, value: perPage },
  ];

  if (filter.jenis) {
    where.push('jenis = @jenis');
    params.push({ name: 'jenis', type: sql.VarChar(20), value: filter.jenis });
  }
  if (filter.status) {
    where.push('status = @status');
    params.push({ name: 'status', type: sql.VarChar(20), value: filter.status });
  }
  if (filter.tanggal_dari) {
    where.push('CAST(created_at AS DATE) >= @tanggal_dari');
    params.push({ name: 'tanggal_dari', type: sql.Date, value: filter.tanggal_dari });
  }
  if (filter.tanggal_sampai) {
    where.push('CAST(created_at AS DATE) <= @tanggal_sampai');
    params.push({ name: 'tanggal_sampai', type: sql.Date, value: filter.tanggal_sampai });
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return queryPage<NotifikasiLogRow>(
    db,
    `SELECT COUNT(*) AS total FROM dbo.log_notifikasi ${whereSql}`,
    `SELECT ${COLUMNS} FROM dbo.log_notifikasi ${whereSql}
      ORDER BY created_at DESC, notif_id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params,
  );
}

export async function findLogById(
  db: Db,
  notifId: string,
): Promise<NotifikasiLogRow | null> {
  const result = await db
    .request()
    .input('notif_id', sql.UniqueIdentifier, notifId)
    .query<NotifikasiLogRow>(
      `SELECT ${COLUMNS} FROM dbo.log_notifikasi WHERE notif_id = @notif_id`,
    );
  return result.recordset[0] ?? null;
}

export async function recordRetry(
  db: Db,
  notifId: string,
  status: NotificationStatus,
): Promise<NotifikasiLogRow | null> {
  const result = await db
    .request()
    .input('notif_id', sql.UniqueIdentifier, notifId)
    .input('status', sql.VarChar(20), status)
    .query<NotifikasiLogRow>(`
      ${OUT_DECL}
      UPDATE dbo.log_notifikasi
      SET retry_count = retry_count + 1,
          status = @status,
          waktu_kirim = CASE
            WHEN @status = 'TERKIRIM' THEN SYSDATETIME()
            ELSE waktu_kirim
          END
      OUTPUT INSERTED.${COLUMNS.replace(/, /g, ', INSERTED.')} INTO @out
      WHERE notif_id = @notif_id;
      SELECT ${COLUMNS} FROM @out;
    `);
  return result.recordset[0] ?? null;
}
