import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/utils/errors';

const stub = async (
  _req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  next(new AppError('ERR-SYS-01'));
};

export const listIdentitas = stub;
export const walkIn = stub;
export const listPasien = stub;
export const rmeDetail = stub;
export const tambahAlergi = stub;
export const konfirmasiRedFlag = stub;
export const buatKunjungan = stub;
export const exportRme = stub;
