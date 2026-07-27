import { describe, it, expect, beforeAll } from 'vitest';
import { apiCall } from './helpers.js';

describe('Comments API', () => {
  let anonymousCookie: string;

  beforeAll(async () => {
    const res = await apiCall('get', '/api/v1/anonymous/me');
    const cookies = res.headers['set-cookie'];
    anonymousCookie = Array.isArray(cookies) ? cookies.join('; ') : (cookies ?? '');
  });

  it('GET /api/v1/comments/review/:reviewPublicId - returns 404 for non-existent review', async () => {
    const res = await apiCall('get', '/api/v1/comments/review/non-existent-id', {
      cookie: anonymousCookie,
    });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/comments - fails without body', async () => {
    const res = await apiCall('post', '/api/v1/comments', {
      cookie: anonymousCookie,
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/comments - fails without anonymous identity', async () => {
    const res = await apiCall('post', '/api/v1/comments', {
      body: { reviewPublicId: 'some-id', content: 'Test comment' },
    });

    // Will get a 401 or similar since no anonymous identity
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
