import type { NextFunction, Request, Response } from 'express';
import sql from 'mssql';
import { ZodError } from 'zod';
import { env } from '@/config/env';
import type { ApiErrorDetail } from '@/types/api';
import { AppError, ERROR_CATALOG, isAppError } from '@/utils/errors';
import type { ErrorCode } from '@/utils/errors';
import { fail } from '@/utils/response';

function isCatalogCode(code: string): code is ErrorCode {
  return Object.prototype.hasOwnProperty.call(ERROR_CATALOG, code);
}

function zodDetails(error: ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'root',
    message: issue.message,
  }));
}

// SQL Server stored procedures raise business errors as THROW 50xxx, N'ERR-XXX-NN|message'.
function fromBusinessMessage(error: Error): AppError | null {
  if (!error.message.startsWith('ERR-')) return null;

  const [code, ...rest] = error.message.split('|');
  if (!isCatalogCode(code)) return new AppError('ERR-SYS-02');

  const message = rest.join('|').trim();
  return new AppError(code, message.length > 0 ? message : undefined);
}

function isBodyParseError(error: SyntaxError): boolean {
  return (error as SyntaxError & { type?: string }).type === 'entity.parse.failed';
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (env.NODE_ENV !== 'production') {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }

  if (isAppError(error)) {
    fail(res, error);
    return;
  }

  if (error instanceof ZodError) {
    fail(res, new AppError('ERR-VAL-01', undefined, zodDetails(error)));
    return;
  }

  if (error instanceof SyntaxError && isBodyParseError(error)) {
    fail(res, new AppError('ERR-VAL-04'));
    return;
  }

  if (error instanceof Error) {
    const business = fromBusinessMessage(error);
    if (business) {
      fail(res, business);
      return;
    }
  }

  if (error instanceof sql.RequestError || error instanceof sql.ConnectionError) {
    fail(res, new AppError('ERR-SYS-02'));
    return;
  }

  fail(res, new AppError('ERR-SYS-01'));
}

export function notFound(_req: Request, res: Response): void {
  fail(res, new AppError('ERR-SYS-01', 'Endpoint tidak ditemukan', undefined, 404));
}
