import { Router } from 'express';
import { updateAlergi } from '@/controllers/alergi.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.patch('/:id', checkRole('BIDAN'), updateAlergi);

export default router;
