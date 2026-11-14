import type { NextFunction, Request, Response } from 'express';
import type { ConnectionPool } from 'mssql';
import { getKontenPage, getLayananPage, getSesiPage } from './service';
import {
  validateKontenList,
  validateLayananList,
  validateSesiList,
} from './validators';
import { ok } from '@/utils/response';

function dbFrom(res: Response): ConnectionPool {
  return res.locals.db as ConnectionPool;
}

export async function listKonten(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = await getKontenPage(dbFrom(res), validateKontenList(req.body));
    ok(res, page.data, 'Berhasil', page.meta);
  } catch (error) {
    next(error);
  }
}

export async function listLayanan(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = await getLayananPage(dbFrom(res), validateLayananList(req.body));
    ok(res, page.data, 'Berhasil', page.meta);
  } catch (error) {
    next(error);
  }
}

export async function listSesi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = await getSesiPage(dbFrom(res), validateSesiList(req.body));
    ok(res, page.data, 'Berhasil', page.meta);
  } catch (error) {
    next(error);
  }
}
