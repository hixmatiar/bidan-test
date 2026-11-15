import type { NextFunction, Request, Response } from 'express';
import type { ConnectionPool } from 'mssql';
import { AppError } from '@/utils/errors';
import { buildMeta, parsePagination } from '@/utils/pagination';
import { ok } from '@/utils/response';
import * as service from './auditLogs.service';
import type { ListAuditLogsInput } from './auditLogs.validators';

function currentDb(res: Response): ConnectionPool {
  const db = res.locals.db;
  if (!db) throw new AppError('ERR-SYS-02');
  return db;
}

export async function listAuditLogs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { current_page, per_page } = parsePagination(req.body);
    const filter = req.body as ListAuditLogsInput;
    const { rows, total } = await service.listAuditLogs(
      currentDb(res),
      filter,
      current_page,
      per_page,
    );
    ok(res, rows, 'Berhasil', buildMeta(total, current_page, per_page));
  } catch (error) {
    next(error);
  }
}
