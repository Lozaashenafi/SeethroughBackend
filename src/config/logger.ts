import pino from 'pino';
import { env } from './env.js';

// Pretty logging only for local dev. Never use a pino transport in
// serverless environments (Vercel) — transports are loaded as worker threads
// that can't resolve modules from the bundled /var/task layout, which crashes
// the function at boot.
const isLocalDev = env.NODE_ENV === 'development' && !process.env.VERCEL;

const transport = isLocalDev
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

export const logger = pino({
  level: env.LOG_LEVEL,
  transport,
  redact: ['req.headers.cookie', 'req.headers.authorization'],
});

