import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';

const app = createApp();

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info({ port: env.PORT, host: env.HOST }, 'Server started');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down server');
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
