import { Router } from 'express';
import { createSesi, listSesi, updateSesi } from '@/controllers/sesi.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/list', checkRole('ADMIN'), listSesi);
router.post('/', checkRole('ADMIN'), createSesi);
router.patch('/:id', checkRole('ADMIN'), updateSesi);

export default router;
