import { Router } from 'express';
import {
  listRiwayatStok,
  restockInventaris,
} from '@/controllers/inventaris.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';
import { validate } from '@/middlewares/validate';
import {
  createInventaris,
  listInventaris,
  updateInventaris,
} from '@/modules/inventaris/inventaris.controller';
import {
  createInventarisSchema,
  idParamSchema,
  updateInventarisSchema,
} from '@/modules/inventaris/inventaris.validators';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/list', checkRole('ADMIN', 'BIDAN'), listInventaris);
router.post(
  '/',
  checkRole('ADMIN'),
  validate({ body: createInventarisSchema }),
  createInventaris,
);
router.patch(
  '/:id',
  checkRole('ADMIN'),
  validate({ params: idParamSchema, body: updateInventarisSchema }),
  updateInventaris,
);
router.post('/:id/restock', checkRole('ADMIN'), restockInventaris);
router.post('/:id/riwayat/list', checkRole('ADMIN', 'BIDAN'), listRiwayatStok);

export default router;
