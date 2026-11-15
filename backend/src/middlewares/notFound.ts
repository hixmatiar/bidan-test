import type { Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import { fail } from '@/utils/response';

export function notFound(_req: Request, res: Response): void {
  fail(res, new AppError('ERR-SYS-01', 'Endpoint tidak ditemukan', undefined, 404));
}
