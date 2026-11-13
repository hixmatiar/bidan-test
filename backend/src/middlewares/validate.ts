import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { ZodTypeAny } from 'zod';
import type { ApiErrorDetail } from '@/types/api';
import { AppError } from '@/utils/errors';

interface ValidateSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
}

function toDetails(error: ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'root',
    message: issue.message,
  }));
}

export function validate(schemas: ValidateSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) {
      const parsed = schemas.body.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError('ERR-VAL-01', undefined, toDetails(parsed.error)));
        return;
      }
      req.body = parsed.data;
    }

    if (schemas.params) {
      const parsed = schemas.params.safeParse(req.params);
      if (!parsed.success) {
        next(new AppError('ERR-VAL-02', undefined, toDetails(parsed.error)));
        return;
      }
      req.params = parsed.data;
    }

    next();
  };
}
