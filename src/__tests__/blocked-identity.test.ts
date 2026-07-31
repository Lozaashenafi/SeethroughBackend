import { describe, it, expect, beforeAll } from 'vitest';
import { apiCall } from './helpers.js';

function getAnonymousCookie(res: { headers: Record<string, unknown> }): string {
  const cookies = res.headers['set-cookie'];
  return Array.isArray(cookies) ? cookies.join('; ') : (cookies ?? '');
}

describe('Blocked anonymous identity', () => {
  let adminCookie: string;

  beforeAll(async () => {
    const anonRes = await apiCall('get', '/api/v1/anonymous/me');
    const anonymousCookie = getAnonymousCookie(anonRes);

    const loginRes = await apiCall('post', '/api/v1/auth/login', {
      body: { email: 'admin@seethrough.com', password: 'admin123' },
      cookie: anonymousCookie,
    });
    adminCookie = getAnonymousCookie(loginRes);
  });

  it('returns 403 for a blocked identity', async () => {
    const meRes = await apiCall('get', '/api/v1/anonymous/me');
    const anonymousCookie = getAnonymousCookie(meRes);
    const publicId = meRes.body.data?.publicId;
    expect(publicId).toBeDefined();

    const blockRes = await apiCall('patch', `/api/v1/anonymous/admin/${publicId}/block`, {
      cookie: adminCookie,
    });
    expect(blockRes.status).toBe(200);

    const res = await apiCall('get', '/api/v1/anonymous/me', { cookie: anonymousCookie });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
