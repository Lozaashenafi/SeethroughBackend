import { describe, it, expect, beforeAll } from 'vitest';
import { apiCall } from './helpers.js';

describe('Votes API', () => {
  let anonymousCookie: string;

  beforeAll(async () => {
    const res = await apiCall('get', '/api/v1/anonymous/me');
    const cookies = res.headers['set-cookie'];
    anonymousCookie = Array.isArray(cookies) ? cookies.join('; ') : (cookies ?? '');
  });

  it('POST /api/v1/votes - fails without body', async () => {
    const res = await apiCall('post', '/api/v1/votes', {
      cookie: anonymousCookie,
      body: {},
    });

    expect(res.status).toBe(400);
  });

  it('POST /api/v1/votes - fails with invalid vote type', async () => {
    const res = await apiCall('post', '/api/v1/votes', {
      cookie: anonymousCookie,
      body: { reviewPublicId: 'some-id', voteType: 'invalid' },
    });

    expect(res.status).toBe(400);
  });

  it('POST /api/v1/votes - fails without anonymous identity', async () => {
    const res = await apiCall('post', '/api/v1/votes', {
      body: { reviewPublicId: 'some-id', voteType: 'helpful' },
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
