import { Router } from 'express';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSessionContext';
import { validate } from '@/middlewares/validate';
import {
  batalReservasi,
  listReservasi,
  rescheduleReservasi,
  updateStatusReservasi,
} from '@/modules/reservasi/reservasi.controller';
import {
  batalReservasiSchema,
  listReservasiSchema,
  rescheduleReservasiSchema,
  reservasiIdParamsSchema,
  updateStatusReservasiSchema,
} from '@/modules/reservasi/reservasi.validators';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post(
  '/list',
  checkRole('ADMIN', 'BIDAN'),
  validate({ body: listReservasiSchema }),
  listReservasi,
);
router.patch(
  '/:id/jadwal',
  checkRole('ADMIN'),
  validate({
    params: reservasiIdParamsSchema,
    body: rescheduleReservasiSchema,
  }),
  rescheduleReservasi,
);
router.patch(
  '/:id/batal',
  checkRole('ADMIN'),
  validate({ params: reservasiIdParamsSchema, body: batalReservasiSchema }),
  batalReservasi,
);
router.patch(
  '/:id/status',
  checkRole('BIDAN'),
  validate({
    params: reservasiIdParamsSchema,
    body: updateStatusReservasiSchema,
  }),
  updateStatusReservasi,
);

export default router;
