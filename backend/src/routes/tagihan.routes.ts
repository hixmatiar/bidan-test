import { Router } from 'express';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';
import { validate } from '@/middlewares/validate';
import {
  catatPembayaran,
  listTagihan,
} from '@/modules/tagihan/tagihan.controller';
import {
  catatPembayaranSchema,
  listTagihanSchema,
  tagihanIdParamsSchema,
} from '@/modules/tagihan/tagihan.validators';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post(
  '/list',
  checkRole('ADMIN'),
  validate({ body: listTagihanSchema }),
  listTagihan,
);
router.post(
  '/:id/pembayaran',
  checkRole('ADMIN'),
  validate({ params: tagihanIdParamsSchema, body: catatPembayaranSchema }),
  catatPembayaran,
);

export default router;
