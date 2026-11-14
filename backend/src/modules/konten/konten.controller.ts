import type { NextFunction, Request, Response } from 'express';
import type { ConnectionPool } from 'mssql';
import { AppError } from '@/utils/errors';
import { buildMeta, parsePagination } from '@/utils/pagination';
import { ok } from '@/utils/response';
import * as service from './konten.service';
import type { CreateKontenInput, ListKontenFilter, UpdateKontenInput } from './konten.validators';

function currentDb(res: Response): ConnectionPool {
  const db = res.locals.db;
  if (!db) throw new AppError('ERR-SYS-02');
  return db;
}

export async function listKonten(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { current_page, per_page } = parsePagination(req.body);
    const filter = req.body as ListKontenFilter;
    const { rows, total } = await service.listKonten(currentDb(res), filter, current_page, per_page);
    ok(res, rows, 'Berhasil', buildMeta(total, current_page, per_page));
  } catch (error) {
    next(error);
  }
}

export async function createKonten(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const row = await service.createKonten(currentDb(res), req.body as CreateKontenInput);
    ok(res, row, 'Konten berhasil dibuat');
  } catch (error) {
    next(error);
  }
}

export async function updateKonten(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const row = await service.updateKonten(
      currentDb(res),
      req.params.id,
      req.body as UpdateKontenInput,
    );
    ok(res, row, 'Konten berhasil diperbarui');
  } catch (error) {
    next(error);
  }
}

export async function deleteKonten(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const row = await service.deleteKonten(currentDb(res), req.params.id);
    ok(res, row, 'Konten berhasil dihapus');
  } catch (error) {
    next(error);
  }
}
