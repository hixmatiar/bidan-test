import type { NextFunction, Request, Response } from 'express';
import type { ConnectionPool } from 'mssql';
import { AppError } from '@/utils/errors';
import { buildMeta, parsePagination } from '@/utils/pagination';
import { ok } from '@/utils/response';
import type { CekPasienInput, IdentitasListFilters } from './pasien.validators';
import * as service from './pasien.service';

function getDb(res: Response): ConnectionPool {
  const db = res.locals.db;
  if (!db) throw new AppError('ERR-SYS-02');
  return db;
}

export async function cekPasien(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.cekPasien(
      getDb(res),
      req.body as CekPasienInput,
    );
    ok(
      res,
      result,
      result.terdaftar ? 'Pasien ditemukan' : 'Pasien tidak ditemukan',
    );
  } catch (error) {
    next(error);
  }
}

export async function listIdentitas(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { current_page, per_page } = parsePagination(req.body);
    const filter = req.body as IdentitasListFilters;
    const result = await service.listIdentitas(
      getDb(res),
      filter,
      current_page,
      per_page,
    );

    ok(
      res,
      result.rows,
      'Daftar identitas pasien berhasil diambil',
      buildMeta(result.total, current_page, per_page),
    );
  } catch (error) {
    next(error);
  }
}
