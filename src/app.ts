import path from 'node:path';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from './config/logger';
import { errorHandler } from './middlewares/errorHandler';
import { htmlTransformMiddleware } from './middlewares/htmlInjector';
import { notFoundHandler } from './middlewares/notFoundHandler';
import songsRouter from './routes/songs';

const HTML_DIR = path.join(__dirname, '..', 'html');

export function createApp(): express.Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(express.json());
  app.use(htmlTransformMiddleware(HTML_DIR));
  app.use(express.static(HTML_DIR));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/songs', songsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
