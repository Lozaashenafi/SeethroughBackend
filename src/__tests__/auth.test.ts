import { describe, it, expect, beforeAll } from 'vitest';
import { apiCall } from './helpers.js';

describe('Auth API', () => {
  const email = 'admin@seethrough.com';
  const password = 'admin123';
  let anonCookie: string;

  beforeAll(async () => {
    // Create a single anonymous identity to use across tests
    const anonRes = await apiCall('get', '/api/v1/anonymous/me');
    const cookies = anonRes.headers['set-cookie'];
    anonCookie = Array.isArray(cookies) ? cookies.join('; ') : (cookies ?? '');
  });

  it('POST /api/v1/auth/login - succeeds with valid credentials', async () => {
    const res = await apiCall('post', '/api/v1/auth/login', {
      body: { email, password },
      cookie: anonCookie,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.token).toBeUndefined();
    expect(res.body.data.admin).toBeDefined();
    expect(res.body.data.admin.email).toBe(email);
    expect(res.body.data.admin.name).toBe('Admin');

    const cookies = res.headers['set-cookie'];
    const setCookie = Array.isArray(cookies) ? cookies.join('; ') : (cookies ?? '');
    expect(setCookie).toContain('admin_token=');
    expect(setCookie).toContain('HttpOnly');
  });

  it('GET /api/v1/auth/me - works with the httpOnly cookie', async () => {
    const loginRes = await apiCall('post', '/api/v1/auth/login', {
      body: { email, password },
      cookie: anonCookie,
    });
    const cookies = loginRes.headers['set-cookie'];
    const adminCookie = Array.isArray(cookies) ? cookies.join('; ') : (cookies ?? '');

    const res = await apiCall('get', '/api/v1/auth/me', { cookie: adminCookie });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(email);
  });

  it('POST /api/v1/auth/logout - clears the admin cookie', async () => {
    const loginRes = await apiCall('post', '/api/v1/auth/login', {
      body: { email, password },
      cookie: anonCookie,
    });
    const cookies = loginRes.headers['set-cookie'];
    const adminCookie = Array.isArray(cookies) ? cookies.join('; ') : (cookies ?? '');

    const res = await apiCall('post', '/api/v1/auth/logout', { cookie: adminCookie });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const clearedCookies = res.headers['set-cookie'];
    const cleared = Array.isArray(clearedCookies) ? clearedCookies.join('; ') : (clearedCookies ?? '');
    expect(cleared).toContain('admin_token=');
    expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('POST /api/v1/auth/login - fails with wrong password', async () => {
    const res = await apiCall('post', '/api/v1/auth/login', {
      body: { email, password: 'wrong-password' },
      cookie: anonCookie,
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/login - fails with non-existent email', async () => {
    const res = await apiCall('post', '/api/v1/auth/login', {
      body: { email: 'nobody@example.com', password: 'admin123' },
      cookie: anonCookie,
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/login - fails with missing fields', async () => {
    const res = await apiCall('post', '/api/v1/auth/login', {
      body: { email },
      cookie: anonCookie,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/login - fails with empty body', async () => {
    const res = await apiCall('post', '/api/v1/auth/login', {
      body: {},
      cookie: anonCookie,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/login - rate limited after many attempts', async () => {
    // Use a dedicated identity for rate limit testing to avoid affecting other tests
    const rateAnon = await apiCall('get', '/api/v1/anonymous/me');
    const rateCookies = rateAnon.headers['set-cookie'];
    const rateCookie = Array.isArray(rateCookies) ? rateCookies.join('; ') : (rateCookies ?? '');

    // Make 10 rapid failed attempts with the SAME identity
    for (let i = 0; i < 10; i++) {
      await apiCall('post', '/api/v1/auth/login', {
        body: { email: 'rate@test.com', password: 'wrong' },
        cookie: rateCookie,
      });
    }

    // The 11th request with the same identity should be rate limited
    const res = await apiCall('post', '/api/v1/auth/login', {
      body: { email: 'rate@test.com', password: 'wrong' },
      cookie: rateCookie,
    });

    expect(res.status).toBe(429);
  });
});
