import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AppError } from '@/utils/errors';
import type { AuthUser, Role } from '@/types/api';

const ALGORITHM = 'HS256';

export function signToken(
  user: AuthUser,
  expiresInSeconds: number = env.JWT_EXPIRES_IN,
): string {
  return jwt.sign({ username: user.username, role: user.role }, env.JWT_SECRET, {
    algorithm: ALGORITHM,
    subject: user.user_id,
    expiresIn: expiresInSeconds,
  });
}

export function verifyToken(token: string): AuthUser {
  let decoded: string | jwt.JwtPayload;

  try {
    decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('ERR-AUTH-04');
    }
    throw new AppError('ERR-AUTH-02');
  }

  if (typeof decoded === 'string') {
    throw new AppError('ERR-AUTH-02');
  }

  const { username, role } = decoded as { username?: unknown; role?: unknown };

  if (
    typeof decoded.sub !== 'string' ||
    typeof username !== 'string' ||
    (role !== 'BIDAN' && role !== 'ADMIN')
  ) {
    throw new AppError('ERR-AUTH-02');
  }

  return {
    user_id: decoded.sub,
    username,
    role: role as Role,
  };
}
