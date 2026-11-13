import { Router } from 'express';
import {
  createInventaris,
  listInventaris,
  listRiwayatStok,
  restockInventaris,
  updateInventaris,
} from '@/controllers/inventaris.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/list', checkRole('ADMIN', 'BIDAN'), listInventaris);
router.post('/', checkRole('ADMIN'), createInventaris);
router.patch('/:id', checkRole('ADMIN'), updateInventaris);
router.post('/:id/restock', checkRole('ADMIN'), restockInventaris);
router.post('/:id/riwayat/list', checkRole('ADMIN', 'BIDAN'), listRiwayatStok);

export default router;
