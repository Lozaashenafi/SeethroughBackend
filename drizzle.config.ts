import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import net from 'node:net';

dotenv.config();

// Node 20+ happy-eyeballs caps each connection attempt at 250ms, which is too
// short for Neon's endpoints and causes ETIMEDOUT. Disable it so migrations
// can connect reliably.
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
