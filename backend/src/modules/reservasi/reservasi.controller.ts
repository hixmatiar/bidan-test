import type { NextFunction, Request, Response } from 'express';
import type { ConnectionPool } from 'mssql';
import type { AuthUser } from '@/types/api';
import { AppError } from '@/utils/errors';
import { buildMeta, parsePagination } from '@/utils/pagination';
import { ok } from '@/utils/response';
import * as service from './reservasi.service';
import type {
  BatalReservasiInput,
  BuatReservasiInput,
  ListReservasiFilters,
  RescheduleReservasiInput,
  UpdateStatusReservasiInput,
} from './reservasi.validators';

function currentDb(res: Response): ConnectionPool {
  const db = res.locals.db;
  if (!db) throw new AppError('ERR-SYS-02');
  return db;
}

function currentUser(req: Request): AuthUser {
  if (!req.user) throw new AppError('ERR-AUTH-02');
  return req.user;
}

function currentIp(req: Request): string | null {
  return req.ip ?? null;
}

export async function buatReservasi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.buatReservasi(
      currentDb(res),
      req.body as BuatReservasiInput,
      currentIp(req),
    );
    res.status(201);
    ok(res, result, 'Reservasi berhasil dibuat');
  } catch (error) {
    next(error);
  }
}

export async function walkIn(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.walkIn(
      currentDb(res),
      req.body as BuatReservasiInput,
      currentUser(req),
      currentIp(req),
    );
    res.status(201);
    ok(res, result, 'Pendaftaran walk-in berhasil');
  } catch (error) {
    next(error);
  }
}

export async function listReservasi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { current_page, per_page } = parsePagination(req.body);
    const result = await service.listReservasi(
      currentDb(res),
      req.body as ListReservasiFilters,
      current_page,
      per_page,
    );
    ok(
      res,
      result.rows,
      'Daftar reservasi berhasil diambil',
      buildMeta(result.total, current_page, per_page),
    );
  } catch (error) {
    next(error);
  }
}

export async function rescheduleReservasi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.rescheduleReservasi(
      currentDb(res),
      req.params.id,
      req.body as RescheduleReservasiInput,
      currentUser(req),
      currentIp(req),
    );
    ok(res, result, 'Jadwal reservasi berhasil diubah');
  } catch (error) {
    next(error);
  }
}

export async function batalReservasi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.batalReservasi(
      currentDb(res),
      req.params.id,
      req.body as BatalReservasiInput,
      currentUser(req),
      currentIp(req),
    );
    ok(res, result, 'Reservasi berhasil dibatalkan');
  } catch (error) {
    next(error);
  }
}

export async function updateStatusReservasi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.updateStatusReservasi(
      currentDb(res),
      req.params.id,
      req.body as UpdateStatusReservasiInput,
    );
    ok(res, result, 'Status reservasi berhasil diperbarui');
  } catch (error) {
    next(error);
  }
}
