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

  // Vercel's rewrites deliver ALL paths to this handler. For /api/* requests
  // it strips the "/api" prefix (e.g. /api/v1/health arrives as /v1/health),
  // while non-API paths (/, /health) arrive unchanged. The previous logic
  // blindly prepended "/api" to everything, which turned "/" into "/api/" and
  // "/health" into "/api/health" — paths no Express route matches, so the root
  // index and health alias always 404'd. Normalize precisely instead:
  //
  //   /v1/*         -> /api/v1/*   (restore the stripped prefix)
  //   /, ""         -> /           (root API index)
  //   /health       -> /health     (health alias, same controller as /api/v1/health)
  //   anything else -> unchanged   (falls through to Express' 404 handler)
  const incoming = req.url ?? '/';
  if (incoming.startsWith('/v1/') || incoming === '/v1') {
    req.url = '/api' + incoming;
  } else if (incoming === '' || incoming === '/api') {
    req.url = '/';
  } else {
    req.url = incoming || '/';
  }

  return app(req, res);
}

export { app };