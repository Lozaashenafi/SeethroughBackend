import { drizzle } from 'drizzle-orm/node-postgres';
import net from 'node:net';
import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

// Node 20+ happy-eyeballs gives each resolved address only 250ms to accept a
// TCP connection. Neon (and some other managed Postgres) endpoints can be
// slower than that, causing spurious ETIMEDOUT errors. Disable it so the full
// connection timeout is used instead.
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error(err, 'Unexpected database pool error');
});

export const db = drizzle(pool);

// Type of the transaction client handed to db.transaction(...) callbacks.
export type DatabaseTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    client.release();
    logger.info('Database connected successfully');
    return true;
  } catch (error) {
    logger.error(error, 'Database connection failed');
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed');
}
