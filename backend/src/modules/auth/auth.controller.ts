import type { NextFunction, Request, Response } from 'express';
import type { ConnectionPool } from 'mssql';
import { AppError } from '@/utils/errors';
import { ok } from '@/utils/response';
import type {
  LoginInput,
  ResetRequestInput,
  ResetVerifyInput,
} from './auth.validators';
import * as service from './auth.service';

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

// ponytail: Express 4 does not forward rejected async handlers; one local catcher.
function handle(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

function db(res: Response): ConnectionPool {
  const pool = res.locals.db;
  if (!pool) throw new AppError('ERR-SYS-01');
  return pool;
}

export const loginHandler = handle(async (req, res) => {
  const result = await service.login(db(res), req.body as LoginInput);
  ok(res, result, 'Login berhasil');
});

export const logoutHandler = handle(async (_req, res) => {
  service.logout();
  ok(res, null, 'Logout berhasil');
});

export const refreshHandler = handle(async (req, res) => {
  if (!req.user) throw new AppError('ERR-AUTH-02');
  ok(res, service.refresh(req.user), 'Token diperbarui');
});

export const requestResetHandler = handle(async (req, res) => {
  const { username } = req.body as ResetRequestInput;
  const message = await service.requestReset(db(res), username);
  ok(res, null, message);
});

export const verifyResetHandler = handle(async (req, res) => {
  const message = await service.verifyReset(db(res), req.body as ResetVerifyInput);
  ok(res, null, message);
});
