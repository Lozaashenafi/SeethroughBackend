import type { CorsOptions } from 'cors';
import { env } from './env.js';

const configuredOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin !== '');

// '*' in CORS_ORIGIN means "allow any browser origin". The cors middleware
// echoes the request origin instead of sending a literal '*', which keeps
// credentialed requests (withCredentials: true) working.
const allowAllOrigins = configuredOrigins.includes('*');

function isValidOrigin(origin: string): boolean {
  if (origin === '') return false;
  try {
    new URL(origin);
    return true;
  } catch {
    return false;
  }
}

export const corsConfig: CorsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header (curl, health checks, server-to-server)
    // are always allowed.
    if (!origin || allowAllOrigins) {
      callback(null, true);
      return;
    }
    callback(null, isValidOrigin(origin) && configuredOrigins.includes(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};
