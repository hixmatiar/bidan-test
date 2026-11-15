import { Router } from 'express';
import {
  loginHandler,
  logoutHandler,
  refreshHandler,
  requestResetHandler,
  verifyResetHandler,
} from '@/modules/auth/auth.controller';
import {
  loginSchema,
  resetRequestSchema,
  resetVerifySchema,
} from '@/modules/auth/auth.validators';
import { authMiddleware } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSessionContext';
import { publicRateLimiter } from '@/middlewares/rateLimit';
import { validate } from '@/middlewares/validate';

const router = Router();

// Public endpoints share the limiter; login writes failed_attempts and its audit
// trigger needs the per-request session context, so both run for the whole router.
router.use(publicRateLimiter, dbSessionContext);

router.post('/login', validate({ body: loginSchema }), loginHandler);
router.post('/logout', authMiddleware, logoutHandler);
router.post('/refresh', authMiddleware, refreshHandler);
router.post('/reset/request', validate({ body: resetRequestSchema }), requestResetHandler);
router.post('/reset/verify', validate({ body: resetVerifySchema }), verifyResetHandler);

export default router;
