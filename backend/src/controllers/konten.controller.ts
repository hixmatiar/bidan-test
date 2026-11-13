import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/utils/errors';

const stub = async (
  _req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  next(new AppError('ERR-SYS-01'));
};

export const listKonten = stub;
export const createKonten = stub;
export const updateKonten = stub;
export const deleteKonten = stub;
