import { Router } from 'express';
import {
  login,
  logout,
  refresh,
  requestReset,
  verifyReset,
} from '@/controllers/auth.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';
import { publicRateLimiter } from '@/middlewares/rateLimit';

const router = Router();

// Public endpoints share the limiter; logout/refresh are guarded per route.
router.use(publicRateLimiter, dbSessionContext);

router.post('/login', login);
router.post('/logout', authMiddleware, checkRole('BIDAN', 'ADMIN'), logout);
router.post('/refresh', authMiddleware, checkRole('BIDAN', 'ADMIN'), refresh);
router.post('/reset/request', requestReset);
router.post('/reset/verify', verifyReset);

export default router;
