import { Router } from 'express';
import {
  buatReservasi,
  cekPasien,
  listKonten,
  listLayanan,
  listSesi,
} from '@/controllers/public.controller';
import { dbSessionContext } from '@/middlewares/dbSession';
import { publicRateLimiter } from '@/middlewares/rateLimit';

const router = Router();

router.use(publicRateLimiter, dbSessionContext);

router.post('/konten/list', listKonten);
router.post('/layanan/list', listLayanan);
router.post('/sesi/list', listSesi);
router.post('/pasien/cek', cekPasien);
router.post('/reservasi', buatReservasi);

export default router;
