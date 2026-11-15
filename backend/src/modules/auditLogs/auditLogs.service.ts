import type { ConnectionPool } from 'mssql';
import * as repository from './auditLogs.repository';
import type { ListAuditLogsInput } from './auditLogs.validators';

export function listAuditLogs(
  db: ConnectionPool,
  filter: ListAuditLogsInput,
  page: number,
  perPage: number,
): Promise<{ rows: repository.AuditLogRow[]; total: number }> {
  return repository.listAuditLogs(db, filter, page, perPage);
}
