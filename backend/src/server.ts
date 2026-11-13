import app from '@/app';
import { env } from '@/config/env';
import { startJobs } from '@/jobs';
import { getPool } from '@/utils/db';

const server = app.listen(env.PORT, () => {
  console.log(`Praktik Bidan API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

void startJobs();

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  // ponytail: hard cap so a hung keep-alive or DB connect cannot block shutdown forever.
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  server.close(() => {
    void getPool()
      .then((pool) => pool.close())
      .catch(() => undefined)
      .finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
