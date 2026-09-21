import type { VercelRequest, VercelResponse } from '@vercel/node';
import { app } from '../src/app/app.js'; 
import { testConnection } from '../src/database/db.js'; 
import { runBootMigrations } from '../src/database/migrate-on-boot.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Update this path to point to where your migrations actually live in source
const migrationsFolder = path.join(__dirname, '..', 'src', 'database', 'migrations');

let isReady = false;

async function ensureReady() {
  if (isReady) return;

  const dbConnected = await testConnection();
  if (dbConnected) {
    try {
      await runBootMigrations(migrationsFolder);
      console.log('Boot migrations completed');
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }

  isReady = true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureReady();

  // Vercel strips the "/api" prefix from req.url before invoking the handler,
  // but Express routes are mounted at "/api/v1/...". Restore the prefix so
  // route matching works correctly.
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + req.url;
  }

  return app(req, res);
}

export { app };