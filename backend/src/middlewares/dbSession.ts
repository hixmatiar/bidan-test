import type { NextFunction, Request, Response } from 'express';
import sql from 'mssql';
import { acquire, release } from '@/utils/db';

const SET_SESSION_CONTEXT = `
EXEC sp_set_session_context @key=N'user_id', @value=@uid;
EXEC sp_set_session_context @key=N'ip', @value=@ip;
`;

export async function dbSessionContext(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  let connection: sql.ConnectionPool;

  try {
    connection = await acquire();
  } catch (error) {
    next(error);
    return;
  }

  // ponytail: finish and close can both fire; one guard keeps a single release.
  let released = false;
  const releaseOnce = (): void => {
    if (released) return;
    released = true;
    void release(connection);
  };

  res.once('finish', releaseOnce);
  res.once('close', releaseOnce);

  try {
    await connection
      .request()
      .input('uid', sql.NVarChar(36), req.user?.user_id ?? null)
      .input('ip', sql.NVarChar(45), req.ip ?? null)
      .query(SET_SESSION_CONTEXT);
  } catch (error) {
    releaseOnce();
    next(error);
    return;
  }

  res.locals.db = connection;
  next();
}
