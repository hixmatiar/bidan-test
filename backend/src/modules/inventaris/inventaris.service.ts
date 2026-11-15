import type sql from 'mssql';
import { AppError } from '@/utils/errors';
import * as repository from './inventaris.repository';
import type { InventarisRow, RiwayatStokRow } from './inventaris.repository';
import type {
  CreateInventarisInput,
  ListInventarisFilter,
  RestockInventarisInput,
  RiwayatStokListFilter,
  UpdateInventarisInput,
} from './inventaris.validators';

export function listInventaris(
  conn: sql.ConnectionPool,
  filter: ListInventarisFilter,
  page: number,
  perPage: number,
): Promise<{ rows: InventarisRow[]; total: number }> {
  return repository.list(conn, filter, page, perPage);
}

export function createInventaris(
  conn: sql.ConnectionPool,
  input: CreateInventarisInput,
  userId: string | null,
): Promise<InventarisRow> {
  return repository.create(conn, input, userId);
}

export async function updateInventaris(
  conn: sql.ConnectionPool,
  itemId: string,
  input: UpdateInventarisInput,
  userId: string | null,
): Promise<InventarisRow> {
  const row = await repository.update(conn, itemId, input, userId);
  if (!row) throw new AppError('ERR-INV-01');
  return row;
}

export function restockInventaris(
  conn: sql.ConnectionPool,
  itemId: string,
  input: RestockInventarisInput,
  userId: string | null,
  ip: string | null,
): Promise<{ item_id: string; stok: number }> {
  return repository.restock(conn, itemId, input, userId, ip);
}

export async function listRiwayatStok(
  conn: sql.ConnectionPool,
  itemId: string,
  filter: RiwayatStokListFilter,
  page: number,
  perPage: number,
): Promise<{ rows: RiwayatStokRow[]; total: number }> {
  const exists = await repository.exists(conn, itemId);
  if (!exists) throw new AppError('ERR-INV-01');
  return repository.listRiwayat(conn, itemId, filter, page, perPage);
}
