import type { NextFunction, Request, Response } from 'express';
import type { ConnectionPool } from 'mssql';
import type { AuthUser } from '@/types/api';
import { AppError } from '@/utils/errors';
import { buildMeta, parsePagination } from '@/utils/pagination';
import { ok } from '@/utils/response';
import * as service from './tagihan.service';
import type {
  CatatPembayaranInput,
  ListTagihanFilters,
} from './tagihan.validators';

function currentDb(res: Response): ConnectionPool {
  const db = res.locals.db;
  if (!db) throw new AppError('ERR-SYS-02');
  return db;
}

function currentUser(req: Request): AuthUser {
  if (!req.user) throw new AppError('ERR-AUTH-02');
  return req.user;
}

export async function tagihanDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.detailTagihan(currentDb(res), req.params.id);
    ok(res, result, 'Detail tagihan berhasil diambil');
  } catch (error) {
    next(error);
  }
}

export async function listTagihan(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { current_page, per_page } = parsePagination(req.body);
    const result = await service.listTagihan(
      currentDb(res),
      req.body as ListTagihanFilters,
      current_page,
      per_page,
    );
    ok(
      res,
      result.rows,
      'Daftar tagihan berhasil diambil',
      buildMeta(result.total, current_page, per_page),
    );
  } catch (error) {
    next(error);
  }
}

export async function catatPembayaran(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.catatPembayaran(
      currentDb(res),
      req.params.id,
      req.body as CatatPembayaranInput,
      currentUser(req).user_id,
      req.ip ?? null,
    );
    res.status(201);
    ok(res, result, 'Pembayaran berhasil dicatat');
  } catch (error) {
    next(error);
  }
}
