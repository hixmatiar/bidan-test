import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from '@/config/env';
import { errorHandler, notFound } from '@/middlewares/errorHandler';
import routes from '@/routes';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    // Explicit allowlist, no wildcard: an origin outside the list simply gets no CORS headers.
    origin(origin, callback) {
      callback(null, !origin || env.CORS_ORIGINS.includes(origin));
    },
  }),
);
app.use(express.json({ limit: '1mb' }));

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
