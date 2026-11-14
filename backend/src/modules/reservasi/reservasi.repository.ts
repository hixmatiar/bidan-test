import sql from 'mssql';
import { AppError } from '@/utils/errors';
import type { ListReservasiFilters } from './reservasi.validators';

type Db = sql.ConnectionPool;

export type ReservasiStatus =
  | 'MENUNGGU'
  | 'DIPANGGIL'
  | 'SELESAI'
  | 'DIBATALKAN';

export type MetodeDaftar = 'ONLINE' | 'MANUAL_ADMIN';

export interface ReservasiRow {
  reservasi_id: string;
  sesi_id: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  nomor_antrean: number;
  estimasi_jam: string;
  status: ReservasiStatus;
  metode_daftar: MetodeDaftar;
  alasan_batal: string | null;
  pasien_id: string;
  nik: string;
  nama_pasien: string;
  no_telepon: string;
  layanan_id: string;
  nama_layanan: string;
  created_at: Date;
  updated_at: Date | null;
}

export interface CreateReservasiParams {
  pasienId: string | null;
  nik: string | null;
  nama: string | null;
  tglLahir: string | null;
  alamat: string | null;
  noTelepon: string | null;
  sesiId: string;
  layananId: string;
  metodeDaftar: MetodeDaftar;
  dibuatOleh: string | null;
  ip: string | null;
}

export interface CreatedReservasi {
  reservasi_id: string;
  nomor_antrean: number;
  estimasi_jam: string | Date;
}

const SELECT_COLUMNS = `
  r.reservasi_id,
  r.sesi_id,
  CONVERT(char(10), s.tanggal, 23) AS tanggal,
  CONVERT(char(8), s.jam_mulai, 108) AS jam_mulai,
  CONVERT(char(8), s.jam_selesai, 108) AS jam_selesai,
  r.nomor_antrean,
  CONVERT(char(8), r.estimasi_jam, 108) AS estimasi_jam,
  r.status,
  r.metode_daftar,
  r.alasan_batal,
  r.pasien_id,
  p.nik,
  p.nama AS nama_pasien,
  p.no_telepon,
  r.layanan_id,
  l.nama AS nama_layanan,
  r.created_at,
  r.updated_at
`;

const FROM_JOINS = `
  FROM dbo.reservasi AS r
  INNER JOIN dbo.sesi_praktik AS s ON s.sesi_id = r.sesi_id
  INNER JOIN dbo.pasien AS p ON p.pasien_id = r.pasien_id
  INNER JOIN dbo.layanan AS l ON l.layanan_id = r.layanan_id
`;

export async function findById(
  db: Db,
  reservasiId: string,
): Promise<ReservasiRow | null> {
  const result = await db
    .request()
    .input('reservasi_id', sql.UniqueIdentifier, reservasiId)
    .query<ReservasiRow>(`
      SELECT ${SELECT_COLUMNS}
      ${FROM_JOINS}
      WHERE r.reservasi_id = @reservasi_id
    `);

  return result.recordset[0] ?? null;
}

export async function createViaSp(
  db: Db,
  params: CreateReservasiParams,
): Promise<CreatedReservasi> {
  const result = await db
    .request()
    .input('pasien_id', sql.UniqueIdentifier, params.pasienId)
    .input('nik', sql.Char(16), params.nik)
    .input('nama', sql.NVarChar(100), params.nama)
    .input('tgl_lahir', sql.Date, params.tglLahir)
    .input('alamat', sql.NVarChar(255), params.alamat)
    .input('no_telepon', sql.NVarChar(20), params.noTelepon)
    .input('sesi_id', sql.UniqueIdentifier, params.sesiId)
    .input('layanan_id', sql.UniqueIdentifier, params.layananId)
    .input('metode_daftar', sql.VarChar(20), params.metodeDaftar)
    .input('dibuat_oleh', sql.UniqueIdentifier, params.dibuatOleh)
    .input('ip', sql.VarChar(45), params.ip ?? '')
    .execute<CreatedReservasi>('dbo.sp_buat_reservasi');

  const created = result.recordset[0];
  if (!created) throw new AppError('ERR-SYS-02');
  return created;
}

export interface RescheduleParams {
  reservasiId: string;
  sesiBaruId: string | null;
  alasan: string;
  userId: string;
  ip: string | null;
}

export async function rescheduleViaSp(
  db: Db,
  params: RescheduleParams,
): Promise<void> {
  await db
    .request()
    .input('reservasi_id', sql.UniqueIdentifier, params.reservasiId)
    .input('sesi_baru', sql.UniqueIdentifier, params.sesiBaruId)
    .input('alasan', sql.NVarChar(255), params.alasan)
    .input('user_id', sql.UniqueIdentifier, params.userId)
    .input('ip', sql.VarChar(45), params.ip ?? '')
    .execute('dbo.sp_reschedule_reservasi');
}

function hasExplicitPeriod(filters: ListReservasiFilters): boolean {
  return (
    filters.tanggal !== undefined ||
    filters.tanggal_dari !== undefined ||
    filters.tanggal_sampai !== undefined ||
    filters.sesi_id !== undefined
  );
}

function bindFilters(
  request: sql.Request,
  filters: ListReservasiFilters,
  today: string,
): sql.Request {
  if (filters.tanggal !== undefined) {
    request.input('tanggal', sql.Date, filters.tanggal);
  } else if (!hasExplicitPeriod(filters)) {
    request.input('today', sql.Date, today);
  }

  if (filters.tanggal_dari !== undefined) {
    request.input('tanggal_dari', sql.Date, filters.tanggal_dari);
  }
  if (filters.tanggal_sampai !== undefined) {
    request.input('tanggal_sampai', sql.Date, filters.tanggal_sampai);
  }
  if (filters.sesi_id !== undefined) {
    request.input('sesi_id', sql.UniqueIdentifier, filters.sesi_id);
  }
  if (filters.status !== undefined) {
    request.input('status', sql.VarChar(20), filters.status);
  }
  if (filters.pasien_id !== undefined) {
    request.input('pasien_id', sql.UniqueIdentifier, filters.pasien_id);
  }
  if (filters.q) {
    request.input('q', sql.NVarChar(100), filters.q);
  }

  return request;
}

function buildWhere(filters: ListReservasiFilters): string {
  const clauses: string[] = [];

  if (filters.tanggal !== undefined) {
    clauses.push('s.tanggal = @tanggal');
  } else if (!hasExplicitPeriod(filters)) {
    clauses.push('s.tanggal = @today');
  }

  if (filters.tanggal_dari !== undefined) {
    clauses.push('s.tanggal >= @tanggal_dari');
  }
  if (filters.tanggal_sampai !== undefined) {
    clauses.push('s.tanggal <= @tanggal_sampai');
  }
  if (filters.sesi_id !== undefined) {
    clauses.push('r.sesi_id = @sesi_id');
  }
  if (filters.status !== undefined) {
    clauses.push('r.status = @status');
  }
  if (filters.pasien_id !== undefined) {
    clauses.push('r.pasien_id = @pasien_id');
  }
  if (filters.q) {
    clauses.push(`(
      p.nama LIKE N'%' + @q + N'%'
      OR p.nik LIKE @q + N'%'
      OR p.no_telepon LIKE N'%' + @q + N'%'
    )`);
  }

  return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
}

export async function list(
  db: Db,
  filters: ListReservasiFilters,
  page: number,
  perPage: number,
  today: string,
): Promise<{ rows: ReservasiRow[]; total: number }> {
  const where = buildWhere(filters);
  const offset = (page - 1) * perPage;

  const countResult = await bindFilters(db.request(), filters, today).query<{
    total: number;
  }>(`
    SELECT COUNT(*) AS total
    ${FROM_JOINS}
    ${where}
  `);

  const rowsResult = await bindFilters(db.request(), filters, today)
    .input('offset', sql.Int, offset)
    .input('per_page', sql.Int, perPage)
    .query<ReservasiRow>(`
      SELECT ${SELECT_COLUMNS}
      ${FROM_JOINS}
      ${where}
      ORDER BY s.tanggal ASC, r.estimasi_jam ASC, r.nomor_antrean ASC
      OFFSET @offset ROWS FETCH NEXT @per_page ROWS ONLY
    `);

  return {
    rows: rowsResult.recordset,
    total: countResult.recordset[0]?.total ?? 0,
  };
}

export async function updateStatus(
  db: Db,
  reservasiId: string,
  status: ReservasiStatus,
): Promise<ReservasiRow | null> {
  const result = await db
    .request()
    .input('reservasi_id', sql.UniqueIdentifier, reservasiId)
    .input('status', sql.VarChar(20), status)
    .query(`
      UPDATE dbo.reservasi
      SET status = @status,
          updated_at = SYSDATETIME()
      WHERE reservasi_id = @reservasi_id
    `);

  if (result.rowsAffected[0] === 0) return null;
  return findById(db, reservasiId);
}
