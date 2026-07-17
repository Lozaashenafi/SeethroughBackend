import { app } from './app/app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { testConnection, closePool } from './database/db.js';

async function main(): Promise<void> {
  logger.info({ environment: env.NODE_ENV }, 'Starting server');

  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.warn('Starting without database connection - some features may be unavailable');
  }

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Server is running');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(async () => {
      logger.info('HTTP server closed');
      await closePool();
      logger.info('Database pool closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error({ err: error }, 'Uncaught exception');
    shutdown('UNCAUGHT_EXCEPTION');
  });
}

main().catch((error) => {
  logger.error({ err: error }, 'Failed to start server');
  process.exit(1);
});
