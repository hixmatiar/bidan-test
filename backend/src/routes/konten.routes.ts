import { Router } from 'express';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';
import { validate } from '@/middlewares/validate';
import {
  createKonten,
  deleteKonten,
  listKonten,
  updateKonten,
} from '@/modules/konten/konten.controller';
import {
  createKontenSchema,
  kontenIdParamsSchema,
  listKontenSchema,
  updateKontenSchema,
} from '@/modules/konten/konten.validators';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/list', checkRole('ADMIN'), validate({ body: listKontenSchema }), listKonten);
router.post('/', checkRole('ADMIN'), validate({ body: createKontenSchema }), createKonten);
router.patch(
  '/:id',
  checkRole('ADMIN'),
  validate({ params: kontenIdParamsSchema, body: updateKontenSchema }),
  updateKonten,
);
router.delete(
  '/:id',
  checkRole('ADMIN'),
  validate({ params: kontenIdParamsSchema }),
  deleteKonten,
);

export default router;
