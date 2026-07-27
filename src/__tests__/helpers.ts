import request from 'supertest';
import { getTestApp } from './setup.js';

// ─── API Request Helpers ───

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface ApiOptions {
  body?: Record<string, unknown>;
  token?: string;
  cookie?: string;
  query?: Record<string, string | number | undefined>;
}

export function apiCall(method: HttpMethod, url: string, options: ApiOptions = {}) {
  const app = getTestApp();
  const req = request(app)[method](url);

  if (options.token) {
    req.set('Authorization', `Bearer ${options.token}`);
  }

  if (options.cookie) {
    req.set('Cookie', options.cookie);
  }

  if (options.body && (method === 'post' || method === 'put' || method === 'patch')) {
    req.send(options.body);
  }

  if (options.query) {
    req.query(options.query);
  }

  return req;
}


