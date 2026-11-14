import type { NextFunction, Request, Response } from 'express';
import type { ConnectionPool } from 'mssql';
import { AppError } from '@/utils/errors';
import { buildMeta, parsePagination } from '@/utils/pagination';
import { ok } from '@/utils/response';
import * as service from './service';
import type { CreateSesiInput, ListSesiFilters, UpdateSesiInput } from './validators';

function getDb(res: Response): ConnectionPool {
  const db = res.locals.db;
  if (!db) throw new AppError('ERR-SYS-02');
  return db;
}

export async function listSesi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { current_page, per_page } = parsePagination(req.body);
    const body = req.body as ListSesiFilters;
    const filters: ListSesiFilters = {
      tanggal_dari: body.tanggal_dari,
      tanggal_sampai: body.tanggal_sampai,
      is_active: body.is_active,
    };

    const result = await service.listSesi(getDb(res), filters, current_page, per_page);
    ok(
      res,
      result.rows,
      result.message,
      buildMeta(result.total, current_page, per_page),
    );
  } catch (error) {
    next(error);
  }
}

export async function createSesi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.createSesi(getDb(res), req.body as CreateSesiInput);
    res.status(201);
    ok(res, result.row, result.message);
  } catch (error) {
    next(error);
  }
}

export async function updateSesi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.updateSesi(
      getDb(res),
      req.params.id,
      req.body as UpdateSesiInput,
    );
    ok(res, result.row, result.message);
  } catch (error) {
    next(error);
  }
}
