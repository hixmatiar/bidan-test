import { Router } from 'express';
import { listAuditLogs } from '@/controllers/auditLogs.controller';
import { authMiddleware, checkRole } from '@/middlewares/auth';
import { dbSessionContext } from '@/middlewares/dbSession';

const router = Router();

router.use(authMiddleware, dbSessionContext);

router.post('/list', checkRole('BIDAN'), listAuditLogs);

export default router;
