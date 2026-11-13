import type { Response } from 'express';
import type {
  ApiFailure,
  ApiSuccess,
  PaginationMeta,
} from '../types/api';
import { ERROR_CATALOG, isAppError } from './errors';

export function ok<T>(
  res: Response,
  data: T,
  message = 'Berhasil',
  meta?: PaginationMeta,
): void {
  const body: ApiSuccess<T> = { status: 'success', data, message };
  if (meta) body.meta = meta;
  res.json(body);
}

export function fail(res: Response, error: unknown): void {
  if (isAppError(error)) {
    const body: ApiFailure = {
      status: 'error',
      error_code: error.code,
      message: error.message,
      errors: error.errors ?? [],
    };
    res.status(error.http).json(body);
    return;
  }

  const body: ApiFailure = {
    status: 'error',
    error_code: 'ERR-SYS-01',
    message: ERROR_CATALOG['ERR-SYS-01'].message,
    errors: [],
  };
  res.status(ERROR_CATALOG['ERR-SYS-01'].http).json(body);
}
