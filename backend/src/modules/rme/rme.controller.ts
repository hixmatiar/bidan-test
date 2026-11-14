import type { NextFunction, Request, Response } from 'express';
import type { ConnectionPool } from 'mssql';
import type { AuthUser } from '@/types/api';
import { AppError } from '@/utils/errors';
import { buildRmePdf } from '@/utils/pdf';
import { ok } from '@/utils/response';
import type {
  BuatKunjunganInput,
  CatatanKunjunganInput,
  TambahAlergiInput,
  UpdateAlergiInput,
} from './rme.validators';
import * as service from './rme.service';

function currentUser(req: Request): AuthUser {
  if (!req.user) throw new AppError('ERR-AUTH-02');
  return req.user;
}

function currentDb(res: Response): ConnectionPool {
  const db = res.locals.db;
  if (!db) throw new AppError('ERR-SYS-02');
  return db;
}

function currentIp(req: Request): string | null {
  return req.ip ?? null;
}

export async function listPasien(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.listPasien(currentDb(res), req.body);
    ok(res, result.rows, 'Daftar pasien berhasil diambil', result.meta);
  } catch (error) {
    next(error);
  }
}

export async function rmeDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.rmeDetail(
      currentDb(res),
      currentUser(req),
      req.params.id,
      currentIp(req),
    );
    ok(res, result, 'Detail RME berhasil diambil');
  } catch (error) {
    next(error);
  }
}

export async function tambahAlergi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.tambahAlergi(
      currentDb(res),
      currentUser(req),
      req.params.id,
      req.body as TambahAlergiInput,
    );
    ok(res, result, 'Alergi atau kondisi berhasil dicatat');
  } catch (error) {
    next(error);
  }
}

export async function updateAlergi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.updateAlergi(
      currentDb(res),
      req.params.id,
      req.body as UpdateAlergiInput,
    );
    ok(res, result, 'Alergi atau kondisi berhasil diperbarui');
  } catch (error) {
    next(error);
  }
}

export async function buatKunjungan(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.buatKunjungan(
      currentDb(res),
      currentUser(req),
      req.params.id,
      req.body as BuatKunjunganInput,
    );
    res.status(201);
    ok(res, result, 'Kunjungan berhasil disimpan');
  } catch (error) {
    next(error);
  }
}

export async function tambahCatatan(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.tambahCatatan(
      currentDb(res),
      currentUser(req),
      req.params.id,
      req.body as CatatanKunjunganInput,
    );
    ok(res, result, 'Catatan kunjungan berhasil ditambahkan');
  } catch (error) {
    next(error);
  }
}

export async function exportRme(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await service.siapkanEksporRme(
      currentDb(res),
      currentUser(req),
      req.params.id,
      currentIp(req),
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${data.filename}"`,
    );

    const doc = buildRmePdf({
      pasien: data.pasien,
      alergi_aktif: data.alergi_aktif,
      kunjungan: data.kunjungan,
      generated_at: data.generated_at,
    });

    doc.on('error', next);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    next(error);
  }
}

export async function konfirmasiRedFlag(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.konfirmasiRedFlag(
      currentDb(res),
      currentUser(req),
      req.params.id,
      currentIp(req),
    );
    ok(res, result, 'Konfirmasi red-flag berhasil dicatat');
  } catch (error) {
    next(error);
  }
}
