import { Router } from 'express';
import {
  kirimUlangNotifikasi,
  listLogNotifikasi,
} from '@/controllers/notifikasi.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/log/list', checkRole('ADMIN'), listLogNotifikasi);
router.post('/:id/kirim-ulang', checkRole('ADMIN'), kirimUlangNotifikasi);

export default router;
