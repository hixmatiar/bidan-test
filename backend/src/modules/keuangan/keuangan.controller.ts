import type { NextFunction, Request, Response } from 'express';
import type { ConnectionPool } from 'mssql';
import { AppError } from '@/utils/errors';
import { ok } from '@/utils/response';
import * as service from './keuangan.service';
import type { RekapPendapatanInput } from './keuangan.validators';

function currentDb(res: Response): ConnectionPool {
  const db = res.locals.db;
  if (!db) throw new AppError('ERR-SYS-02');
  return db;
}

export async function rekapPendapatan(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.rekapPendapatan(
      currentDb(res),
      req.body as RekapPendapatanInput,
    );
    ok(res, result, 'Rekap pendapatan berhasil diambil');
  } catch (error) {
    next(error);
  }
}
