import { Router } from 'express';
import {
  listHarga,
  listRiwayatHarga,
  ubahHarga,
} from '@/controllers/harga.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/list', checkRole('ADMIN', 'BIDAN'), listHarga);
router.put('/:ref_tipe/:ref_id', checkRole('ADMIN'), ubahHarga);
router.post(
  '/:ref_tipe/:ref_id/riwayat/list',
  checkRole('ADMIN', 'BIDAN'),
  listRiwayatHarga,
);

export default router;
