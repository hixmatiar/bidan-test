import { Router } from 'express';
import { dbSessionContext } from '@/middlewares/dbSession';
import { publicRateLimiter } from '@/middlewares/rateLimit';
import { validate } from '@/middlewares/validate';
import { cekPasien } from '@/modules/pasien/pasien.controller';
import { cekPasienSchema } from '@/modules/pasien/pasien.validators';
import { buatReservasi } from '@/modules/reservasi/reservasi.controller';
import { buatReservasiSchema } from '@/modules/reservasi/reservasi.validators';
import {
  listKonten,
  listLayanan,
  listSesi,
} from '@/modules/public/controller';

const router = Router();

router.use(publicRateLimiter, dbSessionContext);

router.post('/konten/list', listKonten);
router.post('/layanan/list', listLayanan);
router.post('/sesi/list', listSesi);
router.post('/pasien/cek', validate({ body: cekPasienSchema }), cekPasien);
router.post(
  '/reservasi',
  validate({ body: buatReservasiSchema }),
  buatReservasi,
);

export default router;
