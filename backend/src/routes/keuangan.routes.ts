import { Router } from 'express';
import { rekapPendapatan } from '@/controllers/keuangan.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/rekap/list', checkRole('ADMIN', 'BIDAN'), rekapPendapatan);

export default router;
