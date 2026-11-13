import { Router } from 'express';
import {
  appendCatatan,
  tagihanDetail,
} from '@/controllers/kunjungan.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.patch('/:id/catatan', checkRole('BIDAN'), appendCatatan);
router.post('/:id/tagihan/detail', checkRole('ADMIN'), tagihanDetail);

export default router;
