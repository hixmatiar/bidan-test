import { Router } from 'express';
import {
  kirimUlangNotifikasi,
  listLogNotifikasi,
} from '@/modules/notifikasi/notifikasi.controller';
import {
  listNotifikasiSchema,
  notifikasiIdParamsSchema,
} from '@/modules/notifikasi/notifikasi.validators';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSessionContext';
import { validate } from '@/middlewares/validate';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post(
  '/log/list',
  checkRole('ADMIN'),
  validate({ body: listNotifikasiSchema }),
  listLogNotifikasi,
);
router.post(
  '/:id/kirim-ulang',
  checkRole('ADMIN'),
  validate({ params: notifikasiIdParamsSchema }),
  kirimUlangNotifikasi,
);

export default router;
