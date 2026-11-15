import { Router } from 'express';
import {
  exportLaporan,
  jamTersibuk,
  perbandingan,
  ringkasan,
  trenLayanan,
} from '@/modules/laporan/laporan.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/ringkasan/list', checkRole('BIDAN'), ringkasan);
router.post('/tren-layanan/list', checkRole('BIDAN'), trenLayanan);
router.post('/jam-tersibuk/list', checkRole('BIDAN'), jamTersibuk);
router.post('/perbandingan/list', checkRole('BIDAN'), perbandingan);
router.post('/export', checkRole('BIDAN'), exportLaporan);

export default router;
