import type { ConnectionPool } from 'mssql';
import type { ListHargaFilter, RiwayatListParams, UbahHargaInput } from './harga.validators';
import * as repository from './harga.repository';
import type { HargaListRow, HargaRiwayatRow, UbahHargaResult } from './harga.repository';

export function listHarga(
  db: ConnectionPool,
  filter: ListHargaFilter,
  page: number,
  perPage: number,
): Promise<{ rows: HargaListRow[]; total: number }> {
  return repository.listHarga(db, filter, page, perPage);
}

export function listRiwayatHarga(
  db: ConnectionPool,
  params: RiwayatListParams,
  page: number,
  perPage: number,
): Promise<{ rows: HargaRiwayatRow[]; total: number }> {
  return repository.listRiwayatHarga(db, params, page, perPage);
}

export async function ubahHarga(
  db: ConnectionPool,
  refTipe: string,
  refId: string,
  input: UbahHargaInput,
  userId: string | null,
  ip: string | null,
): Promise<UbahHargaResult> {
  return repository.ubahHarga(db, refTipe, refId, input, userId, ip);
}
