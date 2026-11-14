import { Router } from 'express';
import { buatKunjungan, exportRme, listIdentitas, walkIn } from '@/controllers/pasien.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';
import { validate } from '@/middlewares/validate';
import {
  konfirmasiRedFlag,
  listPasien,
  rmeDetail,
  tambahAlergi,
} from '@/modules/rme/rme.controller';
import {
  pasienIdParamsSchema,
  tambahAlergiSchema,
} from '@/modules/rme/rme.validators';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/identitas/list', checkRole('ADMIN', 'BIDAN'), listIdentitas);
router.post('/walk-in', checkRole('ADMIN'), walkIn);
router.post('/list', checkRole('BIDAN'), listPasien);
router.post(
  '/:id/rme/detail',
  checkRole('BIDAN'),
  validate({ params: pasienIdParamsSchema }),
  rmeDetail,
);
router.post(
  '/:id/alergi',
  checkRole('BIDAN'),
  validate({ params: pasienIdParamsSchema, body: tambahAlergiSchema }),
  tambahAlergi,
);
router.post(
  '/:id/red-flag/konfirmasi',
  checkRole('BIDAN'),
  validate({ params: pasienIdParamsSchema }),
  konfirmasiRedFlag,
);
router.post('/:id/kunjungan', checkRole('BIDAN'), buatKunjungan);
router.post('/:id/rme/export', checkRole('BIDAN'), exportRme);

export default router;
