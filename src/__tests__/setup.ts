import { beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { pool, testConnection, closePool } from '../database/db.js';
import { router } from '../routes/index.js';
import { errorHandler } from '../middlewares/error.middleware.js';
import { notFoundHandler } from '../middlewares/notFound.middleware.js';

let app: Express;

export function getTestApp(): Express {
  if (!app) {
    app = express();
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

/**
 * Ensure the admins table exists and seed the default admin user.
 * This is needed for auth tests to work against a fresh database.
 */
async function ensureAdminTable(): Promise<void> {
  const client = await pool.connect();
  try {
    // Create admins table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Seed default admin if not exists
    await client.query(`
      INSERT INTO admins (email, password_hash, name)
      VALUES (
        'admin@seethrough.com',
        '$2b$10$gsLxbGPm47Fl4deZYfVqEuXpT8ALi2dNVQVwC1zMuZY7N6Q8w6N2K',
        'Admin'
      )
      ON CONFLICT (email) DO NOTHING;
    `);
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  const connected = await testConnection();
  if (!connected) {
    throw new Error(
      'Database connection failed. Make sure DATABASE_URL is set and the database is running.\n' +
      'For tests, you can set a test database via: DATABASE_URL=postgres://user:pass@localhost:5432/seethrough_test',
    );
  }

  // Ensure the admins table is ready for auth tests
  await ensureAdminTable();
});

afterAll(async () => {
  await closePool();
});
