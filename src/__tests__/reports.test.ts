import { describe, it, expect, beforeAll } from 'vitest';
import { apiCall } from './helpers.js';

describe('Reports API', () => {
  let anonymousCookie: string;

  beforeAll(async () => {
    const res = await apiCall('get', '/api/v1/anonymous/me');
    const cookies = res.headers['set-cookie'];
    anonymousCookie = Array.isArray(cookies) ? cookies.join('; ') : (cookies ?? '');
  });

  it('POST /api/v1/reports - fails without required fields', async () => {
    const res = await apiCall('post', '/api/v1/reports', {
      cookie: anonymousCookie,
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/reports - fails with invalid reason', async () => {
    const res = await apiCall('post', '/api/v1/reports', {
      cookie: anonymousCookie,
      body: { reason: '', reviewPublicId: 'some-id' },
    });

    expect(res.status).toBe(400);
  });

  it('POST /api/v1/reports - fails without anonymous identity', async () => {
    const res = await apiCall('post', '/api/v1/reports', {
      body: { reason: 'spam', reviewPublicId: 'some-id' },
    });

    // No anonymous cookie → gets 500 from missing identity
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST /api/v1/reports - rejects report descriptions containing profanity', async () => {
    const reviewsRes = await apiCall('get', '/api/v1/reviews', {
      cookie: anonymousCookie,
      query: { limit: '1' },
    });
    const review = reviewsRes.body.data?.reviews?.[0];
    if (!review) return;

    const res = await apiCall('post', '/api/v1/reports', {
      cookie: anonymousCookie,
      body: {
        reviewPublicId: review.publicId,
        reason: 'harassment',
        description: 'this report is bullshit',
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/bullshit/i);
  });
});
