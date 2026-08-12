import { app } from './app/app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { db, testConnection, closePool } from './database/db.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Migrations live at src/database/migrations in dev and are copied into
// dist/database/migrations by the build script for production, so the same
// path resolves in both tsx (dev) and node (built) environments.
const migrationsFolder = path.join(__dirname, 'database', 'migrations');

let server: Server;

async function main(): Promise<void> {
  logger.info({ environment: env.NODE_ENV }, 'Starting server');

  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.warn('Starting without database connection - some features may be unavailable');
  }

  // Apply any pending migrations on boot (dev + production, skipped under
  // test). This keeps the deployed schema in sync with the code — a stale
  // schema previously caused 500s on every endpoint touching
  // anonymous_identities/reviews after a deploy.
  if (dbConnected && env.NODE_ENV !== 'test') {
    try {
      await migrate(db, { migrationsFolder });
      logger.info('Database migrations applied');
    } catch (error) {
      logger.error(
        { err: error },
        'Failed to apply database migrations — content endpoints may be unavailable until the schema is migrated',
      );
    }
  }

  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Server is running');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');

    server.close(async (err) => {
      if (err) {
        logger.error({ err }, 'Error closing HTTP server');
        await closePool();
        process.exit(1);
      }

      logger.info('HTTP server closed');
      await closePool();
      logger.info('Database pool closed');
      process.exit(0);
    });

    server.closeIdleConnections();

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
    logger.error({ err: error }, 'Uncaught exception — crashing');
    if (server) server.closeIdleConnections();
    closePool().finally(() => process.exit(1));
  });
}

main().catch((error) => {
  logger.error({ err: error }, 'Failed to start server');
  process.exit(1);
});
