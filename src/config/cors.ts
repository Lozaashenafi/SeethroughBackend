import type { CorsOptions } from 'cors';
import { env } from './env.js';

const configuredOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin !== '');

// '*' in CORS_ORIGIN means "allow any browser origin". The cors middleware
// echoes the request origin instead of sending a literal '*', which keeps
// credentialed requests (withCredentials: true) working.
const allowAllOrigins = configuredOrigins.includes('*');

// Exact-match hosts plus their registrable-domain suffixes. For a configured
// origin like https://seethroughfront.vercel.app this matches every Vercel
// preview/deploy subdomain of *.vercel.app, so cookies keep working on
// production deployments whose exact Origin the backend config didn't predict.
const exactHosts = new Set<string>();
const suffixHosts: string[] = [];

for (const origin of configuredOrigins) {
  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    continue;
  }
  exactHosts.add(host);
  // A host with at least two dot-separated labels can act as a suffix matcher
  // (e.g. foo.vercel.app -> *.vercel.app). Single-label hosts like "localhost"
  // stay exact-only.
  const labels = host.split('.');
  if (labels.length >= 2) {
    suffixHosts.push(`.${labels.slice(-2).join('.')}`);
  }
}

function originAllowed(origin: string): boolean {
  if (origin === '') return false;
  try {
    const { hostname } = new URL(origin);
    const host = hostname.toLowerCase();
    if (exactHosts.has(host)) return true;
    return suffixHosts.some((suffix) => host.endsWith(suffix));
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
    callback(null, originAllowed(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  maxAge: 86400,
};
