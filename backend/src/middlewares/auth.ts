import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import { verifyToken } from '@/utils/jwt';
import type { Role } from '@/types/api';

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;

  if (!header) {
    next(new AppError('ERR-AUTH-02'));
    return;
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(new AppError('ERR-AUTH-02'));
    return;
  }

  try {
    req.user = verifyToken(token);
  } catch (error) {
    // verifyToken already distinguishes expired (ERR-AUTH-04) from invalid (ERR-AUTH-02)
    next(error);
    return;
  }

  next();
}

export function checkRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError('ERR-AUTH-03'));
      return;
    }
    next();
  };
}
