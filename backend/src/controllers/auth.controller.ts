import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/utils/errors';

const stub = async (
  _req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  next(new AppError('ERR-SYS-01'));
};

export const login = stub;
export const logout = stub;
export const refresh = stub;
export const requestReset = stub;
export const verifyReset = stub;
