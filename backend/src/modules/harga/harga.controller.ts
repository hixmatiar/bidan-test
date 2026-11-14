import type { NextFunction, Request, Response } from 'express';
import type { ConnectionPool } from 'mssql';
import { AppError } from '@/utils/errors';
import { buildMeta, parsePagination } from '@/utils/pagination';
import { ok } from '@/utils/response';
import * as service from './harga.service';
import { parseListHarga, parseRiwayatListParams } from './harga.validators';
import type { UbahHargaInput } from './harga.validators';

function connection(res: Response): ConnectionPool {
  const conn = res.locals.db;
  if (!conn) throw new AppError('ERR-SYS-01');
  return conn;
}

export async function listHarga(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { current_page, per_page } = parsePagination(req.body);
    const filter = parseListHarga(req.body);
    const { rows, total } = await service.listHarga(
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

export async function ubahHarga(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const row = await service.ubahHarga(
      connection(res),
      req.params.ref_tipe,
      req.params.ref_id,
      req.body as UbahHargaInput,
      req.user?.user_id ?? null,
      req.ip ?? null,
    );

    ok(res, row, 'Harga berhasil diperbarui');
  } catch (error) {
    next(error);
  }
}

export async function listRiwayatHarga(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { current_page, per_page } = parsePagination(req.body);
    const params = parseRiwayatListParams(req.params);
    const { rows, total } = await service.listRiwayatHarga(
      connection(res),
      params,
      current_page,
      per_page,
    );

    ok(res, rows, 'Berhasil', buildMeta(total, current_page, per_page));
  } catch (error) {
    next(error);
  }
}
