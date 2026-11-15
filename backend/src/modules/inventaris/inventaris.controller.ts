import type { NextFunction, Request, Response } from 'express';
import type { ConnectionPool } from 'mssql';
import { AppError } from '@/utils/errors';
import { buildMeta, parsePagination } from '@/utils/pagination';
import { ok } from '@/utils/response';
import * as service from './inventaris.service';
import { parseListInventaris, parseRiwayatStokList } from './inventaris.validators';
import type {
  CreateInventarisInput,
  RestockInventarisInput,
  UpdateInventarisInput,
} from './inventaris.validators';

function connection(res: Response): ConnectionPool {
  const conn = res.locals.db;
  if (!conn) throw new AppError('ERR-SYS-01');
  return conn;
}

export async function listInventaris(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { current_page, per_page } = parsePagination(req.body);
    const filter = parseListInventaris(req.body);
    const { rows, total } = await service.listInventaris(
      connection(res),
      filter,
      current_page,
      per_page,
    );

    ok(res, rows, 'Berhasil', buildMeta(total, current_page, per_page));
  } catch (error) {
    next(error);
  }
}

export async function createInventaris(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const row = await service.createInventaris(
      connection(res),
      req.body as CreateInventarisInput,
      req.user?.user_id ?? null,
    );

    ok(res, row, 'Item inventaris berhasil dibuat');
  } catch (error) {
    next(error);
  }
}

export async function updateInventaris(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const row = await service.updateInventaris(
      connection(res),
      req.params.id,
      req.body as UpdateInventarisInput,
      req.user?.user_id ?? null,
    );

    ok(res, row, 'Item inventaris berhasil diperbarui');
  } catch (error) {
    next(error);
  }
}

export async function restockInventaris(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const row = await service.restockInventaris(
      connection(res),
      req.params.id,
      req.body as RestockInventarisInput,
      req.user?.user_id ?? null,
      req.ip ?? null,
    );

    ok(res, row, 'Stok berhasil ditambahkan');
  } catch (error) {
    next(error);
  }
}

export async function listRiwayatStok(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { current_page, per_page } = parsePagination(req.body);
    const filter = parseRiwayatStokList(req.body);
    const { rows, total } = await service.listRiwayatStok(
      connection(res),
      req.params.id,
      filter,
      current_page,
      per_page,
    );

    ok(res, rows, 'Berhasil', buildMeta(total, current_page, per_page));
  } catch (error) {
    next(error);
  }
}
