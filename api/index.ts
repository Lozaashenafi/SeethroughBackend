import type { VercelRequest, VercelResponse } from '@vercel/node';
import { app } from '../dist/app/app.js';
import { db, testConnection, closePool } from '../dist/database/db.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, '..', 'dist', 'database', 'migrations');

let isReady = false;

async function ensureReady() {
  if (isReady) return;

  const dbConnected = await testConnection();
  if (dbConnected) {
    try {
      await migrate(db, { migrationsFolder });
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }

  isReady = true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureReady();
  return app(req, res);
}

export { app };
