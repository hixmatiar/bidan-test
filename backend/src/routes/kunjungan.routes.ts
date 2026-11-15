import { Router } from 'express';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSessionContext';
import { validate } from '@/middlewares/validate';
import { tambahCatatan } from '@/modules/rme/rme.controller';
import {
  catatanKunjunganSchema,
  kunjunganIdParamsSchema,
} from '@/modules/rme/rme.validators';
import { tagihanDetail } from '@/modules/tagihan/tagihan.controller';
import { kunjunganIdParamsSchema as tagihanKunjunganParamsSchema } from '@/modules/tagihan/tagihan.validators';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.patch(
  '/:id/catatan',
  checkRole('BIDAN'),
  validate({ params: kunjunganIdParamsSchema, body: catatanKunjunganSchema }),
  tambahCatatan,
);
router.post(
  '/:id/tagihan/detail',
  checkRole('ADMIN'),
  validate({ params: tagihanKunjunganParamsSchema }),
  tagihanDetail,
);

export default router;
