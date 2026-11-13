import { rateLimit } from 'express-rate-limit';
import { env } from '@/config/env';
import { AppError } from '@/utils/errors';
import { fail } from '@/utils/response';

export const publicRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_PUBLIC,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    // ERR-SYS-03 defaults to 503; the limiter is the 429 transport.
    fail(res, new AppError('ERR-SYS-03', undefined, undefined, 429));
  },
});
