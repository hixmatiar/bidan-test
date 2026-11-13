import { Router } from 'express';
import {
  buatKunjungan,
  exportRme,
  konfirmasiRedFlag,
  listIdentitas,
  listPasien,
  rmeDetail,
  tambahAlergi,
  walkIn,
} from '@/controllers/pasien.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/identitas/list', checkRole('ADMIN', 'BIDAN'), listIdentitas);
router.post('/walk-in', checkRole('ADMIN'), walkIn);
router.post('/list', checkRole('BIDAN'), listPasien);
router.post('/:id/rme/detail', checkRole('BIDAN'), rmeDetail);
router.post('/:id/alergi', checkRole('BIDAN'), tambahAlergi);
router.post('/:id/red-flag/konfirmasi', checkRole('BIDAN'), konfirmasiRedFlag);
router.post('/:id/kunjungan', checkRole('BIDAN'), buatKunjungan);
router.post('/:id/rme/export', checkRole('BIDAN'), exportRme);

export default router;
