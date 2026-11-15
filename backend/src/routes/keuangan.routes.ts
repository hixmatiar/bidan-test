import { Router } from 'express';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSessionContext';
import { validate } from '@/middlewares/validate';
import { rekapPendapatan } from '@/modules/keuangan/keuangan.controller';
import { rekapPendapatanSchema } from '@/modules/keuangan/keuangan.validators';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post(
  '/rekap/list',
  checkRole('ADMIN', 'BIDAN'),
  validate({ body: rekapPendapatanSchema }),
  rekapPendapatan,
);

export default router;
