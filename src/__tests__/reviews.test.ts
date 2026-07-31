import { describe, it, expect, beforeAll } from 'vitest';
import { apiCall } from './helpers.js';

describe('Reviews API', () => {
  let anonymousCookie: string;

  beforeAll(async () => {
    const anonRes = await apiCall('get', '/api/v1/anonymous/me');
    const cookies = anonRes.headers['set-cookie'];
    anonymousCookie = Array.isArray(cookies) ? cookies.join('; ') : (cookies ?? '');
  });

  it('GET /api/v1/reviews - returns list of reviews (public)', async () => {
    const res = await apiCall('get', '/api/v1/reviews', { cookie: anonymousCookie });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.reviews)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
  });

  it('GET /api/v1/reviews - paginates correctly', async () => {
    const res = await apiCall('get', '/api/v1/reviews', {
      cookie: anonymousCookie,
      query: { page: '1', limit: '5' },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.limit).toBe(5);
  });

  it('GET /api/v1/reviews?companySlug=xxx - returns 404 for non-existent company', async () => {
    const res = await apiCall('get', '/api/v1/reviews', {
      cookie: anonymousCookie,
      query: { companySlug: 'non-existent-company' },
    });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/reviews/:publicId - returns 404 for non-existent review', async () => {
    const res = await apiCall('get', '/api/v1/reviews/non-existent-id', {
      cookie: anonymousCookie,
    });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/reviews/admin/all - fails without admin token', async () => {
    const res = await apiCall('get', '/api/v1/reviews/admin/all', {
      cookie: anonymousCookie,
    });

    expect(res.status).toBe(401);
  });

  it('DELETE /api/v1/reviews/:publicId - fails without admin token', async () => {
    const res = await apiCall('delete', '/api/v1/reviews/some-review', {
      cookie: anonymousCookie,
    });

    expect(res.status).toBe(401);
  });

  it('POST /api/v1/reviews - fails without body', async () => {
    const res = await apiCall('post', '/api/v1/reviews', {
      cookie: anonymousCookie,
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
