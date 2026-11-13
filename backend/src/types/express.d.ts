import type { ConnectionPool } from 'mssql';
import type { AuthUser } from './api';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }

    interface Locals {
      db?: ConnectionPool;
    }
  }
}

export {};
