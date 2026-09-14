import { beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { pool, testConnection, closePool } from '../database/db.js';
import { router } from '../routes/index.js';
import { errorHandler } from '../middlewares/error.middleware.js';
import { notFoundHandler } from '../middlewares/notFound.middleware.js';

let app: Express;

export function getTestApp(): Express {
  if (!app) {
    app = express();
    // Mirror app.ts: rate limiters key on req.ip, which is only behind the
    // proxy when trust proxy is set. Tests use it to run as separate clients.
    app.set('trust proxy', 1);
    app.use(helmet());
    app.use(compression());
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '10kb' }));
    app.use(express.urlencoded({ extended: true, limit: '10kb' }));
    app.use(cookieParser());
    app.use((req, _res, next) => {
      req.requestId = 'test-request-id';
      next();
    });
    app.use(router);
    app.use(notFoundHandler);
    app.use(errorHandler);
  }
  return app;
}

export const TEST_ADMIN_EMAIL = 'admin@seethrough.com';
export const TEST_ADMIN_PASSWORD = 'admin123';

/**
 * Ensure the default admin account exists with a known password.
 *
 * Admin auth moved from a dedicated `admins` table to `role = 'admin'` on
 * `users`, so tests seed a user row instead of creating a table. The password
 * hash is computed here (rather than hardcoded) so it always matches a real
 * bcrypt hash of TEST_ADMIN_PASSWORD.
 */
async function ensureAdminUser(): Promise<void> {
  const passwordHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, 10);

  await pool.query(
    `INSERT INTO users (email, password_hash, display_name, role, email_verified)
     VALUES ($1, $2, 'Admin', 'admin', true)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = 'admin',
           email_verified = true,
           is_blocked = false,
           temp_blocked_until = NULL`,
    [TEST_ADMIN_EMAIL, passwordHash],
  );
}

beforeAll(async () => {
  const connected = await testConnection();
  if (!connected) {
    throw new Error(
      'Database connection failed. Make sure DATABASE_URL is set and the database is running.\n' +
      'For tests, you can set a test database via: DATABASE_URL=postgres://user:pass@localhost:5432/seethrough_test',
    );
  }

  // The schema must already be migrated (`pnpm db:migrate`); tests never run
  // migrations so a missing table surfaces as a clear failure here.
  await ensureAdminUser();
});

afterAll(async () => {
  await closePool();
});
