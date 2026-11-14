import type { ConnectionPool } from 'mssql';
import { AppError } from '@/utils/errors';
import * as repository from './konten.repository';
import type { KontenRow } from './konten.repository';
import type { CreateKontenInput, ListKontenFilter, UpdateKontenInput } from './konten.validators';

export function listKonten(
  db: ConnectionPool,
  filter: ListKontenFilter,
  page: number,
  perPage: number,
): Promise<{ rows: KontenRow[]; total: number }> {
  return repository.listKonten(db, filter, page, perPage);
}

export function createKonten(
  db: ConnectionPool,
  input: CreateKontenInput,
): Promise<KontenRow> {
  return repository.createKonten(db, input);
}

export async function updateKonten(
  db: ConnectionPool,
  id: string,
  input: UpdateKontenInput,
): Promise<KontenRow> {
  const row = await repository.updateKonten(db, id, input);
  if (!row) throw new AppError('ERR-CNT-01');
  return row;
}

export async function deleteKonten(
  db: ConnectionPool,
  id: string,
): Promise<KontenRow> {
  const row = await repository.softDeleteKonten(db, id);
  if (!row) throw new AppError('ERR-CNT-01');
  return row;
}
