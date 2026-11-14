import type { ConnectionPool } from 'mssql';
import { AppError } from '@/utils/errors';
import * as repository from './repository';
import type { SesiRow } from './repository';
import type {
  CreateSesiInput,
  ListSesiFilters,
  UpdateSesiInput,
} from './validators';

const MESSAGES = {
  created: 'Sesi praktik berhasil dibuat',
  updated: 'Sesi praktik berhasil diperbarui',
  listed: 'Berhasil',
} as const;

export interface SesiListResult {
  rows: SesiRow[];
  total: number;
  message: string;
}

export async function listSesi(
  db: ConnectionPool,
  filters: ListSesiFilters,
  page: number,
  perPage: number,
): Promise<SesiListResult> {
  const { rows, total } = await repository.list(db, filters, page, perPage);
  return { rows, total, message: MESSAGES.listed };
}

export async function createSesi(
  db: ConnectionPool,
  input: CreateSesiInput,
): Promise<{ row: SesiRow; message: string }> {
  const overlap = await repository.countOverlap(
    db,
    input.tanggal,
    input.jam_mulai,
    input.jam_selesai,
  );
  if (overlap > 0) throw new AppError('ERR-RSV-02');

  const sesiId = await repository.create(db, input);
  const row = await repository.findById(db, sesiId);
  if (!row) throw new AppError('ERR-SYS-02');

  return { row, message: MESSAGES.created };
}

export async function updateSesi(
  db: ConnectionPool,
  sesiId: string,
  input: UpdateSesiInput,
): Promise<{ row: SesiRow; message: string }> {
  const existing = await repository.findById(db, sesiId);
  if (!existing) throw new AppError('ERR-RSV-03');

  const tanggal = input.tanggal ?? existing.tanggal;
  const jamMulai = input.jam_mulai ?? existing.jam_mulai;
  const jamSelesai = input.jam_selesai ?? existing.jam_selesai;

  if (jamSelesai <= jamMulai) {
    throw new AppError('ERR-VAL-01', undefined, [
      { path: 'jam_selesai', message: 'jam_selesai harus lebih besar dari jam_mulai' },
    ]);
  }

  if (
    input.tanggal !== undefined ||
    input.jam_mulai !== undefined ||
    input.jam_selesai !== undefined
  ) {
    const overlap = await repository.countOverlap(
      db,
      tanggal,
      jamMulai,
      jamSelesai,
      sesiId,
    );
    if (overlap > 0) throw new AppError('ERR-RSV-02');
  }

  if (input.kuota_maks !== undefined) {
    const booked = await repository.countActiveReservations(db, sesiId);
    if (input.kuota_maks < booked) throw new AppError('ERR-RSV-01');
  }

  await repository.update(db, sesiId, input);
  const row = await repository.findById(db, sesiId);
  if (!row) throw new AppError('ERR-RSV-03');

  return { row, message: MESSAGES.updated };
}
