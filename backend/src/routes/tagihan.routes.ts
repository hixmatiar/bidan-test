import { Router } from 'express';
import {
  catatPembayaran,
  listTagihan,
} from '@/controllers/tagihan.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/list', checkRole('ADMIN'), listTagihan);
router.post('/:id/pembayaran', checkRole('ADMIN'), catatPembayaran);

export default router;
