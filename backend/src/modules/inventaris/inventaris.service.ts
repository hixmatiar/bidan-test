import type sql from 'mssql';
import { AppError } from '@/utils/errors';
import * as repository from './inventaris.repository';
import type { InventarisRow } from './inventaris.repository';
import type {
  CreateInventarisInput,
  ListInventarisFilter,
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
