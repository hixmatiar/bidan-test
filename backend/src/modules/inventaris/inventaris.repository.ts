import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { AppError } from '@/utils/errors';
import type {
  CreateInventarisInput,
  ListInventarisFilter,
  UpdateInventarisInput,
} from './inventaris.validators';

export interface InventarisRow {
  item_id: string;
  nama: string;
  kategori: string;
  satuan: string;
  stok: number;
  stok_minimum: number;
  tgl_kedaluwarsa: Date | null;
  days_to_expiry: number | null;
  status_stok: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
}

const SELECT_COLUMNS = `
  item_id, nama, kategori, satuan, stok, stok_minimum, tgl_kedaluwarsa,
  days_to_expiry, status_stok, is_active, created_at, updated_at
`;

function listWhere(filter: ListInventarisFilter): string {
  const clauses: string[] = [];
  if (filter.kategori) clauses.push('kategori = @kategori');
  if (filter.status_stok) clauses.push('status_stok = @status_stok');
  if (filter.q) clauses.push('nama LIKE @q');
  return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
}

function bindFilter(
  request: sql.Request,
  filter: ListInventarisFilter,
): sql.Request {
  if (filter.kategori) {
    request.input('kategori', sql.VarChar(30), filter.kategori);
  }
  if (filter.status_stok) {
    request.input('status_stok', sql.VarChar(20), filter.status_stok);
  }
  if (filter.q) {
    request.input('q', sql.NVarChar(102), `%${filter.q}%`);
  }
  return request;
}

async function transaction<T>(
  conn: sql.ConnectionPool,
  fn: (tx: sql.Transaction) => Promise<T>,
): Promise<T> {
  const tx = new sql.Transaction(conn);
  await tx.begin();

  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // rollback is best-effort: the connection may already be aborted
    }
    throw error;
  }
}

function insertOpenPrice(
  tx: sql.Transaction,
  itemId: string,
  harga: number,
  userId: string | null,
  alasan: string,
): Promise<unknown> {
  return new sql.Request(tx)
    .input('item_id', sql.UniqueIdentifier, itemId)
    .input('harga', sql.Decimal(18, 2), harga)
    .input('uid', sql.UniqueIdentifier, userId)
    .input('alasan', sql.NVarChar(255), alasan)
    .query(`
      INSERT INTO dbo.riwayat_harga
        (ref_tipe, item_id, harga, berlaku_dari, berlaku_sampai, alasan, diubah_oleh)
      VALUES
        ('ITEM', @item_id, @harga,
         CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE),
         NULL, @alasan, @uid)
    `);
}

async function findRow(
  tx: sql.Transaction,
  itemId: string,
): Promise<InventarisRow | null> {
  const result = await new sql.Request(tx)
    .input('item_id', sql.UniqueIdentifier, itemId)
    .query(`
      SELECT ${SELECT_COLUMNS}
      FROM dbo.v_inventaris_status
      WHERE item_id = @item_id
    `);

  const rows = result.recordset as InventarisRow[];
  return rows[0] ?? null;
}

export async function list(
  conn: sql.ConnectionPool,
  filter: ListInventarisFilter,
  page: number,
  perPage: number,
): Promise<{ rows: InventarisRow[]; total: number }> {
  const where = listWhere(filter);
  const offset = (page - 1) * perPage;

  const countResult = await bindFilter(conn.request(), filter).query(`
    SELECT COUNT(*) AS total
    FROM dbo.v_inventaris_status
    ${where}
  `);

  const rowsResult = await bindFilter(conn.request(), filter)
    .input('offset', sql.Int, offset)
    .input('per_page', sql.Int, perPage)
    .query(`
      SELECT ${SELECT_COLUMNS}
      FROM dbo.v_inventaris_status
      ${where}
      ORDER BY nama ASC, item_id ASC
      OFFSET @offset ROWS FETCH NEXT @per_page ROWS ONLY
    `);

  return {
    rows: rowsResult.recordset as InventarisRow[],
    total: Number((countResult.recordset[0] as { total: number }).total),
  };
}

export async function create(
  conn: sql.ConnectionPool,
  input: CreateInventarisInput,
  userId: string | null,
): Promise<InventarisRow> {
  return transaction(conn, async (tx) => {
    // App-generated id: the audit trigger blocks OUTPUT without INTO on this table.
    const itemId = randomUUID();

    await new sql.Request(tx)
      .input('item_id', sql.UniqueIdentifier, itemId)
      .input('nama', sql.NVarChar(100), input.nama)
      .input('kategori', sql.VarChar(30), input.kategori)
      .input('satuan', sql.NVarChar(20), input.satuan)
      .input('stok', sql.Decimal(10, 2), input.stok)
      .input('stok_minimum', sql.Decimal(10, 2), input.stok_minimum ?? 0)
      .input('tgl_kedaluwarsa', sql.VarChar(10), input.tgl_kedaluwarsa ?? null)
      .query(`
        INSERT INTO dbo.item_inventaris
          (item_id, nama, kategori, satuan, stok, stok_minimum, tgl_kedaluwarsa)
        VALUES
          (@item_id, @nama, @kategori, @satuan, @stok, @stok_minimum,
           CAST(@tgl_kedaluwarsa AS DATE))
      `);

    if (input.harga !== undefined) {
      await insertOpenPrice(tx, itemId, input.harga, userId, 'Harga awal item');
    }

    const row = await findRow(tx, itemId);
    if (!row) throw new AppError('ERR-SYS-01');
    return row;
  });
}

export async function update(
  conn: sql.ConnectionPool,
  itemId: string,
  input: UpdateInventarisInput,
  userId: string | null,
): Promise<InventarisRow | null> {
  return transaction(conn, async (tx) => {
    const exists = await new sql.Request(tx)
      .input('item_id', sql.UniqueIdentifier, itemId)
      .query(`
        SELECT 1 AS ada
        FROM dbo.item_inventaris WITH (UPDLOCK, HOLDLOCK)
        WHERE item_id = @item_id
      `);

    if (exists.recordset.length === 0) return null;

    const sets: string[] = [];
    const request = new sql.Request(tx).input(
      'item_id',
      sql.UniqueIdentifier,
      itemId,
    );

    if (input.nama !== undefined) {
      sets.push('nama = @nama');
      request.input('nama', sql.NVarChar(100), input.nama);
    }
    if (input.satuan !== undefined) {
      sets.push('satuan = @satuan');
      request.input('satuan', sql.NVarChar(20), input.satuan);
    }
    if (input.stok_minimum !== undefined) {
      sets.push('stok_minimum = @stok_minimum');
      request.input('stok_minimum', sql.Decimal(10, 2), input.stok_minimum);
    }
    if (input.tgl_kedaluwarsa !== undefined) {
      sets.push('tgl_kedaluwarsa = CAST(@tgl_kedaluwarsa AS DATE)');
      request.input('tgl_kedaluwarsa', sql.VarChar(10), input.tgl_kedaluwarsa);
    }
    if (input.is_active !== undefined) {
      sets.push('is_active = @is_active');
      request.input('is_active', sql.Bit, input.is_active);
    }

    if (sets.length > 0) {
      sets.push('updated_at = SYSDATETIME()');
      await request.query(`
        UPDATE dbo.item_inventaris
        SET ${sets.join(', ')}
        WHERE item_id = @item_id
      `);
    }

    if (input.harga !== undefined) {
      // Close the open price the day before the new one starts; same-day rows stay valid
      // today so the CHECK (berlaku_sampai >= berlaku_dari) holds.
      await new sql.Request(tx)
        .input('item_id', sql.UniqueIdentifier, itemId)
        .query(`
          UPDATE dbo.riwayat_harga
          SET berlaku_sampai = CASE
                WHEN berlaku_dari < CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE)
                  THEN DATEADD(DAY, -1, CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE))
                ELSE CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00') AS DATE)
              END
          WHERE ref_tipe = 'ITEM'
            AND item_id = @item_id
            AND berlaku_sampai IS NULL
        `);

      await insertOpenPrice(tx, itemId, input.harga, userId, 'Perubahan harga item');
    }

    return findRow(tx, itemId);
  });
}
