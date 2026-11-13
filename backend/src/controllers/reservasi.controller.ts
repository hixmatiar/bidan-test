import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/utils/errors';

const stub = async (
  _req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  next(new AppError('ERR-SYS-01'));
};

export const listReservasi = stub;
export const rescheduleReservasi = stub;
export const batalReservasi = stub;
export const updateStatusReservasi = stub;
