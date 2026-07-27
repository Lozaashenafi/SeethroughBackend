import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

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
