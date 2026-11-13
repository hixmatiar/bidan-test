import { Router } from 'express';
import {
  createKonten,
  deleteKonten,
  listKonten,
  updateKonten,
} from '@/controllers/konten.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/list', checkRole('ADMIN'), listKonten);
router.post('/', checkRole('ADMIN'), createKonten);
router.patch('/:id', checkRole('ADMIN'), updateKonten);
router.delete('/:id', checkRole('ADMIN'), deleteKonten);

export default router;
