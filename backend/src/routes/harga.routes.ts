import { Router } from 'express';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSessionContext';
import { validate } from '@/middlewares/validate';
import { listHarga, listRiwayatHarga, ubahHarga } from '@/modules/harga/harga.controller';
import { ubahHargaParamsSchema, riwayatListParamsSchema, ubahHargaSchema } from '@/modules/harga/harga.validators';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/list', checkRole('ADMIN', 'BIDAN'), listHarga);
router.put(
  '/:ref_tipe/:ref_id',
  checkRole('ADMIN'),
  validate({ params: ubahHargaParamsSchema, body: ubahHargaSchema }),
  ubahHarga,
);
router.post(
  '/:ref_tipe/:ref_id/riwayat/list',
  checkRole('ADMIN', 'BIDAN'),
  validate({ params: riwayatListParamsSchema }),
  listRiwayatHarga,
);

export default router;
