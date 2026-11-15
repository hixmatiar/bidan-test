import { Router } from 'express';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSessionContext';
import { validate } from '@/middlewares/validate';
import { updateAlergi } from '@/modules/rme/rme.controller';
import {
  alergiIdParamsSchema,
  updateAlergiSchema,
} from '@/modules/rme/rme.validators';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.patch(
  '/:id',
  checkRole('BIDAN'),
  validate({ params: alergiIdParamsSchema, body: updateAlergiSchema }),
  updateAlergi,
);

export default router;
