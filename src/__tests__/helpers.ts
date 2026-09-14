import request from 'supertest';
import { getTestApp } from './setup.js';

// ─── API Request Helpers ───

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface ApiOptions {
  body?: Record<string, unknown>;
  cookie?: string;
  query?: Record<string, string | number | undefined>;
  /** Extra request headers, e.g. a synthetic X-Forwarded-For to isolate rate limits. */
  headers?: Record<string, string>;
}

export function apiCall(method: HttpMethod, url: string, options: ApiOptions = {}) {
  const app = getTestApp();
  const req = request(app)[method](url);

  if (options.cookie) {
    req.set('Cookie', options.cookie);
  }

  if (options.body && (method === 'post' || method === 'put' || method === 'patch')) {
    req.send(options.body);
  }

  if (options.query) {
    req.query(options.query);
  }

  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      req.set(key, value);
    }
  }

  return req;
}


