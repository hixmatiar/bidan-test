import type { NextFunction, Request, Response } from 'express';
import type { ConnectionPool } from 'mssql';
import { AppError } from '@/utils/errors';
import { buildMeta, parsePagination } from '@/utils/pagination';
import { ok } from '@/utils/response';
import * as service from './notifikasi.service';
import type { ListNotifikasiInput } from './notifikasi.validators';

function currentDb(res: Response): ConnectionPool {
  const db = res.locals.db;
  if (!db) throw new AppError('ERR-SYS-02');
  return db;
}

export async function listLogNotifikasi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { current_page, per_page } = parsePagination(req.body);
    const filter = req.body as ListNotifikasiInput;
    const { rows, total } = await service.listLogs(
      currentDb(res),
      filter,
      current_page,
      per_page,
    );
    ok(res, rows, 'Berhasil', buildMeta(total, current_page, per_page));
  } catch (error) {
    next(error);
  }
}

export async function kirimUlangNotifikasi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const row = await service.resend(currentDb(res), req.params.id);
    ok(res, row, 'Notifikasi berhasil diproses ulang');
  } catch (error) {
    next(error);
  }
}
