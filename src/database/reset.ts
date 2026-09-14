import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { closePool, db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Matches src/server.ts: migrations live next to the compiled/source code.
const migrationsFolder = path.join(__dirname, 'migrations');

/**
 * Wipes the database and replays every migration from scratch.
 *
 * Both `public` (application tables) and `drizzle` (applied-migration ledger)
 * are dropped, so the result is byte-for-byte what a brand new database gets —
 * stale ledger rows from an old migration chain are removed too.
 *
 * Destructive by design: never run this against anything but a local/dev
 * database. The seed data is not reapplied here — run `pnpm db:seed` after
 * (the `db:reset` npm script chains both).
 */
async function reset(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to drop schemas: NODE_ENV is production');
  }

  const { hostname, port, pathname } = new URL(env.DATABASE_URL);
  logger.warn(
    { database: pathname.replace(/^\//, ''), host: hostname, port },
    'Dropping schemas "public" and "drizzle" — all data will be lost',
  );

  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);

  await migrate(db, { migrationsFolder });

  logger.info('Migrations applied to the empty database');
}

reset()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error({ err: error }, '❌ Database reset failed');
    await closePool().finally(() => process.exit(1));
  });
