import { Router } from 'express';
import { createSesi, listSesi, updateSesi } from '@/modules/sesi/controller';
import {
  createSesiSchema,
  listSesiSchema,
  sesiIdParams,
  updateSesiSchema,
} from '@/modules/sesi/validators';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';
import { validate } from '@/middlewares/validate';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/list', checkRole('ADMIN'), validate({ body: listSesiSchema }), listSesi);
router.post('/', checkRole('ADMIN'), validate({ body: createSesiSchema }), createSesi);
router.patch(
  '/:id',
  checkRole('ADMIN'),
  validate({ body: updateSesiSchema, params: sesiIdParams }),
  updateSesi,
);

export default router;
