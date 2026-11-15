import { Router } from 'express';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';
import { validate } from '@/middlewares/validate';
import { listAuditLogs } from '@/modules/auditLogs/auditLogs.controller';
import { listAuditLogsSchema } from '@/modules/auditLogs/auditLogs.validators';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/list', checkRole('BIDAN'), validate({ body: listAuditLogsSchema }), listAuditLogs);

export default router;
