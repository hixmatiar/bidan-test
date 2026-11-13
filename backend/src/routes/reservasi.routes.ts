import { Router } from 'express';
import {
  batalReservasi,
  listReservasi,
  rescheduleReservasi,
  updateStatusReservasi,
} from '@/controllers/reservasi.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/list', checkRole('ADMIN', 'BIDAN'), listReservasi);
router.patch('/:id/jadwal', checkRole('ADMIN'), rescheduleReservasi);
router.patch('/:id/batal', checkRole('ADMIN'), batalReservasi);
router.patch('/:id/status', checkRole('BIDAN'), updateStatusReservasi);

export default router;
