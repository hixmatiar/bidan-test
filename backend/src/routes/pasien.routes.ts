import { Router } from 'express';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSessionContext';
import { validate } from '@/middlewares/validate';
import { listIdentitas } from '@/modules/pasien/pasien.controller';
import { identitasListSchema } from '@/modules/pasien/pasien.validators';
import { walkIn } from '@/modules/reservasi/reservasi.controller';
import { buatReservasiSchema } from '@/modules/reservasi/reservasi.validators';
import {
  buatKunjungan,
  exportRme,
  konfirmasiRedFlag,
  listPasien,
  rmeDetail,
  tambahAlergi,
} from '@/modules/rme/rme.controller';
import {
  buatKunjunganSchema,
  pasienIdParamsSchema,
  tambahAlergiSchema,
} from '@/modules/rme/rme.validators';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post(
  '/identitas/list',
  checkRole('ADMIN', 'BIDAN'),
  validate({ body: identitasListSchema }),
  listIdentitas,
);
router.post(
  '/walk-in',
  checkRole('ADMIN'),
  validate({ body: buatReservasiSchema }),
  walkIn,
);
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
router.post(
  '/:id/kunjungan',
  checkRole('BIDAN'),
  validate({ params: pasienIdParamsSchema, body: buatKunjunganSchema }),
  buatKunjungan,
);
router.post(
  '/:id/rme/export',
  checkRole('BIDAN'),
  validate({ params: pasienIdParamsSchema }),
  exportRme,
);

export default router;
