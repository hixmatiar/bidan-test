import sql from 'mssql';
import { AppError } from '@/utils/errors';

type Db = sql.ConnectionPool;

export interface PasienListRow {
  pasien_id: string;
  nik: string;
  nama: string;
  tgl_lahir: Date;
  no_telepon: string;
  is_active: boolean;
  has_red_flag: boolean;
  jumlah_kunjungan: number;
  kunjungan_terakhir: Date | null;
}

export interface ProfilRmeRow {
  pasien_id: string;
  nik: string;
  nama: string;
  tgl_lahir: Date;
  alamat: string | null;
  no_telepon: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
  jumlah_kunjungan: number;
  kunjungan_terakhir: Date | null;
  jumlah_red_flag_aktif: number;
}

export interface AlergiRow {
  alergi_id: string;
  pasien_id: string;
  item_id: string | null;
  kategori: 'ALERGI_OBAT' | 'KEHAMILAN_RISTI' | 'PENYAKIT_BAWAAN';
  nama: string | null;
  keterangan: string | null;
  is_active: boolean;
  dicatat_oleh: string | null;
  created_at: Date;
  updated_at: Date | null;
  item_nama: string | null;
}

export interface KunjunganRow {
  kunjungan_id: string;
  tanggal_kunjungan: Date;
  keluhan: string | null;
  pemeriksaan_fisik: string | null;
  diagnosis: string | null;
  tindakan: string | null;
  catatan_bebas: string | null;
  koreksi_dari_id: string | null;
  layanan_nama: string;
  bidan_username: string;
}

export interface ResepRow {
  resep_id: string;
  kunjungan_id: string;
  item_id: string;
  item_nama: string;
  satuan: string;
  jumlah: number;
  aturan_pakai: string | null;
  created_at: Date;
}

export type KunjunganDenganResep = KunjunganRow & { resep: ResepRow[] };

const PASIEN_SEARCH_WHERE = `
  WHERE p.is_active = 1
    AND (
      @q IS NULL
      OR p.nama LIKE N'%' + @q + N'%'
      OR p.nik LIKE @q + '%'
      OR p.no_telepon LIKE N'%' + @q + N'%'
    )
`;

export async function listPasien(
  db: Db,
  params: { q: string | null; page: number; perPage: number },
): Promise<{ rows: PasienListRow[]; total: number }> {
  const offset = (params.page - 1) * params.perPage;

  const countResult = await db
    .request()
    .input('q', sql.NVarChar(100), params.q)
    .query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM dbo.pasien AS p ${PASIEN_SEARCH_WHERE}`,
    );

  const rowsResult = await db
    .request()
    .input('q', sql.NVarChar(100), params.q)
    .input('offset', sql.Int, offset)
    .input('per_page', sql.Int, params.perPage)
    .query<PasienListRow>(`
      SELECT
        p.pasien_id,
        p.nik,
        p.nama,
        p.tgl_lahir,
        p.no_telepon,
        p.is_active,
        CAST(CASE WHEN EXISTS (
          SELECT 1
          FROM dbo.alergi_kondisi AS a
          WHERE a.pasien_id = p.pasien_id
            AND a.is_active = 1
            AND a.kategori IN ('ALERGI_OBAT', 'KEHAMILAN_RISTI')
        ) THEN 1 ELSE 0 END AS BIT) AS has_red_flag,
        (SELECT COUNT(*) FROM dbo.kunjungan AS k WHERE k.pasien_id = p.pasien_id) AS jumlah_kunjungan,
        (SELECT MAX(k.tanggal_kunjungan) FROM dbo.kunjungan AS k WHERE k.pasien_id = p.pasien_id) AS kunjungan_terakhir
      FROM dbo.pasien AS p
      ${PASIEN_SEARCH_WHERE}
      ORDER BY p.nama, p.pasien_id
      OFFSET @offset ROWS FETCH NEXT @per_page ROWS ONLY
    `);

  return {
    rows: rowsResult.recordset,
    total: countResult.recordset[0]?.total ?? 0,
  };
}

export async function findProfilRme(
  db: Db,
  pasienId: string,
): Promise<ProfilRmeRow | null> {
  const result = await db
    .request()
    .input('pasien_id', sql.UniqueIdentifier, pasienId)
    .query<ProfilRmeRow>(
      `SELECT pasien_id, nik, nama, tgl_lahir, alamat, no_telepon, is_active,
              created_at, updated_at, jumlah_kunjungan, kunjungan_terakhir,
              jumlah_red_flag_aktif
       FROM dbo.v_profil_rme
       WHERE pasien_id = @pasien_id`,
    );

  return result.recordset[0] ?? null;
}

export async function listAlergiAktif(
  db: Db,
  pasienId: string,
): Promise<AlergiRow[]> {
  const result = await db
    .request()
    .input('pasien_id', sql.UniqueIdentifier, pasienId)
    .query<AlergiRow>(`
      SELECT a.alergi_id, a.pasien_id, a.item_id, a.kategori, a.nama,
             a.keterangan, a.is_active, a.dicatat_oleh, a.created_at, a.updated_at,
             i.nama AS item_nama
      FROM dbo.alergi_kondisi AS a
      LEFT JOIN dbo.item_inventaris AS i ON i.item_id = a.item_id
      WHERE a.pasien_id = @pasien_id AND a.is_active = 1
      ORDER BY a.created_at DESC, a.alergi_id
    `);

  return result.recordset;
}

export async function listKunjunganDenganResep(
  db: Db,
  pasienId: string,
): Promise<KunjunganDenganResep[]> {
  const kunjunganResult = await db
    .request()
    .input('pasien_id', sql.UniqueIdentifier, pasienId)
    .query<KunjunganRow>(`
      SELECT k.kunjungan_id, k.tanggal_kunjungan, k.keluhan, k.pemeriksaan_fisik,
             k.diagnosis, k.tindakan, k.catatan_bebas, k.koreksi_dari_id,
             l.nama AS layanan_nama, u.username AS bidan_username
      FROM dbo.kunjungan AS k
      INNER JOIN dbo.layanan AS l ON l.layanan_id = k.layanan_id
      INNER JOIN dbo.users AS u ON u.user_id = k.bidan_id
      WHERE k.pasien_id = @pasien_id
      ORDER BY k.tanggal_kunjungan DESC, k.created_at DESC
    `);

  const resepResult = await db
    .request()
    .input('pasien_id', sql.UniqueIdentifier, pasienId)
    .query<ResepRow>(`
      SELECT r.resep_id, r.kunjungan_id, r.item_id, i.nama AS item_nama,
             i.satuan, r.jumlah, r.aturan_pakai, r.created_at
      FROM dbo.resep_item AS r
      INNER JOIN dbo.kunjungan AS k ON k.kunjungan_id = r.kunjungan_id
      INNER JOIN dbo.item_inventaris AS i ON i.item_id = r.item_id
      WHERE k.pasien_id = @pasien_id
      ORDER BY r.created_at, r.resep_id
    `);

  const resepByKunjungan = new Map<string, ResepRow[]>();
  for (const resep of resepResult.recordset) {
    const key = resep.kunjungan_id.toLowerCase();
    const items = resepByKunjungan.get(key) ?? [];
    items.push(resep);
    resepByKunjungan.set(key, items);
  }

  return kunjunganResult.recordset.map((kunjungan) => ({
    ...kunjungan,
    resep: resepByKunjungan.get(kunjungan.kunjungan_id.toLowerCase()) ?? [],
  }));
}

export async function pasienExists(db: Db, pasienId: string): Promise<boolean> {
  const result = await db
    .request()
    .input('pasien_id', sql.UniqueIdentifier, pasienId)
    .query<{ found: number }>(
      'SELECT TOP 1 1 AS found FROM dbo.pasien WHERE pasien_id = @pasien_id',
    );

  return result.recordset.length > 0;
}

export async function itemExists(db: Db, itemId: string): Promise<boolean> {
  const result = await db
    .request()
    .input('item_id', sql.UniqueIdentifier, itemId)
    .query<{ found: number }>(
      'SELECT TOP 1 1 AS found FROM dbo.item_inventaris WHERE item_id = @item_id',
    );

  return result.recordset.length > 0;
}

export async function insertAlergi(
  db: Db,
  params: {
    pasienId: string;
    kategori: string;
    nama: string;
    itemId: string | null;
    keterangan: string | null;
    dicatatOleh: string;
  },
): Promise<AlergiRow> {
  const result = await db
    .request()
    .input('pasien_id', sql.UniqueIdentifier, params.pasienId)
    .input('kategori', sql.VarChar(20), params.kategori)
    .input('nama', sql.NVarChar(150), params.nama)
    .input('item_id', sql.UniqueIdentifier, params.itemId)
    .input('keterangan', sql.NVarChar(500), params.keterangan)
    .input('dicatat_oleh', sql.UniqueIdentifier, params.dicatatOleh)
    .query<AlergiRow>(`
      SET NOCOUNT ON;

      DECLARE @inserted TABLE (alergi_id UNIQUEIDENTIFIER);

      INSERT INTO dbo.alergi_kondisi
        (pasien_id, item_id, kategori, nama, keterangan, dicatat_oleh)
      OUTPUT INSERTED.alergi_id INTO @inserted
      VALUES (@pasien_id, @item_id, @kategori, @nama, @keterangan, @dicatat_oleh);

      SELECT a.alergi_id, a.pasien_id, a.item_id, a.kategori, a.nama,
             a.keterangan, a.is_active, a.dicatat_oleh, a.created_at, a.updated_at,
             i.nama AS item_nama
      FROM dbo.alergi_kondisi AS a
      LEFT JOIN dbo.item_inventaris AS i ON i.item_id = a.item_id
      INNER JOIN @inserted AS n ON n.alergi_id = a.alergi_id;
    `);

  return result.recordset[0];
}

export async function updateAlergi(
  db: Db,
  alergiId: string,
  changes: { isActive?: boolean; keterangan?: string | null },
): Promise<AlergiRow | null> {
  const hasFields =
    changes.isActive !== undefined || changes.keterangan !== undefined;

  if (!hasFields) {
    const existing = await db
      .request()
      .input('alergi_id', sql.UniqueIdentifier, alergiId)
      .query<AlergiRow>(`
        SELECT a.alergi_id, a.pasien_id, a.item_id, a.kategori, a.nama,
               a.keterangan, a.is_active, a.dicatat_oleh, a.created_at, a.updated_at,
               i.nama AS item_nama
        FROM dbo.alergi_kondisi AS a
        LEFT JOIN dbo.item_inventaris AS i ON i.item_id = a.item_id
        WHERE a.alergi_id = @alergi_id
      `);
    return existing.recordset[0] ?? null;
  }

  const request = db
    .request()
    .input('alergi_id', sql.UniqueIdentifier, alergiId);
  const assignments: string[] = [];

  if (changes.isActive !== undefined) {
    request.input('is_active', sql.Bit, changes.isActive);
    assignments.push('is_active = @is_active');
  }

  if (changes.keterangan !== undefined) {
    request.input('keterangan', sql.NVarChar(500), changes.keterangan);
    assignments.push('keterangan = @keterangan');
  }

  assignments.push('updated_at = SYSDATETIME()');

  const result = await request.query<AlergiRow>(`
    SET NOCOUNT ON;

    DECLARE @updated TABLE (alergi_id UNIQUEIDENTIFIER);

    UPDATE dbo.alergi_kondisi
    SET ${assignments.join(', ')}
    OUTPUT INSERTED.alergi_id INTO @updated
    WHERE alergi_id = @alergi_id;

    SELECT a.alergi_id, a.pasien_id, a.item_id, a.kategori, a.nama,
           a.keterangan, a.is_active, a.dicatat_oleh, a.created_at, a.updated_at,
           i.nama AS item_nama
    FROM dbo.alergi_kondisi AS a
    LEFT JOIN dbo.item_inventaris AS i ON i.item_id = a.item_id
    INNER JOIN @updated AS n ON n.alergi_id = a.alergi_id;
  `);

  return result.recordset[0] ?? null;
}

export interface CreatedKunjungan {
  kunjungan_id: string;
  tagihan_id: string;
  total_tagihan: number;
}

export interface CatatanKunjunganRow {
  kunjungan_id: string;
  catatan_bebas: string | null;
}

export async function hasRedFlagConfirmationToday(
  db: Db,
  pasienId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .request()
    .input('pasien_id', sql.UniqueIdentifier, pasienId)
    .input('user_id', sql.UniqueIdentifier, userId)
    .query<{ found: number }>(`
      SELECT TOP 1 1 AS found
      FROM dbo.audit_logs
      WHERE aksi = 'RED_FLAG_CONFIRMED'
        AND entitas = 'pasien'
        AND entitas_id = CONVERT(NVARCHAR(64), @pasien_id)
        AND user_id = @user_id
        AND CAST(DATEADD(MINUTE, 420, created_at) AS DATE) = CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE)
    `);

  return result.recordset.length > 0;
}

export async function kunjunganMilikPasien(
  db: Db,
  kunjunganId: string,
  pasienId: string,
): Promise<boolean> {
  const result = await db
    .request()
    .input('kunjungan_id', sql.UniqueIdentifier, kunjunganId)
    .input('pasien_id', sql.UniqueIdentifier, pasienId)
    .query<{ found: number }>(`
      SELECT TOP 1 1 AS found
      FROM dbo.kunjungan
      WHERE kunjungan_id = @kunjungan_id AND pasien_id = @pasien_id
    `);

  return result.recordset.length > 0;
}

export async function createKunjunganViaSp(
  db: Db,
  params: {
    pasienId: string;
    reservasiId: string | null;
    bidanId: string;
    layananId: string;
    tanggalKunjungan: Date;
    keluhan: string;
    pemeriksaanFisik: string;
    diagnosis: string;
    tindakan: string;
    catatanBebas: string | null;
    koreksiDariId: string | null;
    resep: Array<{
      itemId: string;
      jumlah: number;
      aturanPakai: string | null;
    }>;
  },
): Promise<CreatedKunjungan> {
  const resep = new sql.Table('dbo.tvp_resep');
  resep.columns.add('item_id', sql.UniqueIdentifier, { nullable: false });
  resep.columns.add('jumlah', sql.Decimal(10, 2), { nullable: false });
  resep.columns.add('aturan_pakai', sql.NVarChar(100), { nullable: true });

  for (const item of params.resep) {
    resep.rows.add(item.itemId, item.jumlah, item.aturanPakai);
  }

  const result = await db
    .request()
    .input('pasien_id', sql.UniqueIdentifier, params.pasienId)
    .input('reservasi_id', sql.UniqueIdentifier, params.reservasiId)
    .input('bidan_id', sql.UniqueIdentifier, params.bidanId)
    .input('layanan_id', sql.UniqueIdentifier, params.layananId)
    .input('tanggal_kunjungan', sql.DateTime2, params.tanggalKunjungan)
    .input('keluhan', sql.NVarChar(sql.MAX), params.keluhan)
    .input('pemeriksaan_fisik', sql.NVarChar(sql.MAX), params.pemeriksaanFisik)
    .input('diagnosis', sql.NVarChar(sql.MAX), params.diagnosis)
    .input('tindakan', sql.NVarChar(sql.MAX), params.tindakan)
    .input('catatan_bebas', sql.NVarChar(sql.MAX), params.catatanBebas)
    .input('koreksi_dari_id', sql.UniqueIdentifier, params.koreksiDariId)
    .input('resep', resep)
    .execute<CreatedKunjungan>('dbo.sp_simpan_kunjungan');

  const created = result.recordset[0];
  if (!created) throw new AppError('ERR-SYS-02');

  return created;
}

export async function appendCatatanKunjungan(
  db: Db,
  kunjunganId: string,
  appendText: string,
): Promise<CatatanKunjunganRow | null> {
  const result = await db
    .request()
    .input('kunjungan_id', sql.UniqueIdentifier, kunjunganId)
    .input('append_text', sql.NVarChar(sql.MAX), appendText)
    .query<CatatanKunjunganRow>(`
      SET NOCOUNT ON;

      UPDATE dbo.kunjungan
      SET catatan_bebas = ISNULL(catatan_bebas, N'') + @append_text
      OUTPUT INSERTED.kunjungan_id, INSERTED.catatan_bebas
      WHERE kunjungan_id = @kunjungan_id;
    `);

  return result.recordset[0] ?? null;
}

export async function insertAuditDataExported(
  db: Db,
  params: {
    pasienId: string;
    userId: string;
    username: string;
    ip: string | null;
  },
): Promise<void> {
  await db
    .request()
    .input('user_id', sql.UniqueIdentifier, params.userId)
    .input('user_ref', sql.NVarChar(50), params.username)
    .input('entitas_id', sql.NVarChar(64), params.pasienId)
    .input('ip_address', sql.VarChar(45), params.ip)
    .query(`
      INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address)
      VALUES
        (@user_id, @user_ref, 'DATA_EXPORTED', 'pasien', @entitas_id, NULL, NULL, @ip_address)
    `);
}

export async function insertAuditViewRme(
  db: Db,
  params: {
    pasienId: string;
    userId: string;
    username: string;
    ip: string | null;
  },
): Promise<void> {
  await db
    .request()
    .input('user_id', sql.UniqueIdentifier, params.userId)
    .input('user_ref', sql.NVarChar(50), params.username)
    .input('entitas_id', sql.NVarChar(64), params.pasienId)
    .input('ip_address', sql.VarChar(45), params.ip)
    .query(`
      INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address)
      VALUES
        (@user_id, @user_ref, 'VIEW_RME', 'pasien', @entitas_id, NULL, NULL, @ip_address)
    `);
}

export async function insertAuditRedFlagConfirmed(
  db: Db,
  params: {
    pasienId: string;
    userId: string;
    username: string;
    ip: string | null;
    snapshotJson: string;
  },
): Promise<Date> {
  const result = await db
    .request()
    .input('user_id', sql.UniqueIdentifier, params.userId)
    .input('user_ref', sql.NVarChar(50), params.username)
    .input('entitas_id', sql.NVarChar(64), params.pasienId)
    .input('nilai_baru', sql.NVarChar(sql.MAX), params.snapshotJson)
    .input('ip_address', sql.VarChar(45), params.ip)
    .query<{ created_at: Date }>(`
      INSERT INTO dbo.audit_logs
        (user_id, user_ref, aksi, entitas, entitas_id, nilai_lama, nilai_baru, ip_address)
      OUTPUT INSERTED.created_at
      VALUES
        (@user_id, @user_ref, 'RED_FLAG_CONFIRMED', 'pasien', @entitas_id, NULL, @nilai_baru, @ip_address)
    `);

  return result.recordset[0].created_at;
}
