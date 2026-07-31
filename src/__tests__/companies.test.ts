import { describe, it, expect, beforeAll } from 'vitest';
import { apiCall } from './helpers.js';

describe('Companies API', () => {
  let adminCookie: string;
  let anonymousCookie: string;

  beforeAll(async () => {
    const anonRes = await apiCall('get', '/api/v1/anonymous/me');
    const cookies = anonRes.headers['set-cookie'];
    anonymousCookie = Array.isArray(cookies) ? cookies.join('; ') : (cookies ?? '');

    const loginRes = await apiCall('post', '/api/v1/auth/login', {
      body: { email: 'admin@seethrough.com', password: 'admin123' },
      cookie: anonymousCookie,
    });
    const loginCookies = loginRes.headers['set-cookie'];
    adminCookie = Array.isArray(loginCookies) ? loginCookies.join('; ') : (loginCookies ?? '');
  });

  it('GET /api/v1/companies - returns list of companies', async () => {
    const res = await apiCall('get', '/api/v1/companies', { cookie: anonymousCookie });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.companies)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.page).toBe(1);
  });

  it('GET /api/v1/companies - searches by name', async () => {
    const res = await apiCall('get', '/api/v1/companies', {
      cookie: anonymousCookie,
      query: { search: 'tech' },
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/v1/companies - paginates correctly', async () => {
    const res = await apiCall('get', '/api/v1/companies', {
      cookie: anonymousCookie,
      query: { page: '1', limit: '5' },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.limit).toBe(5);
    expect(res.body.data.pagination.page).toBe(1);
  });

  it('GET /api/v1/companies/:slug - returns 404 for non-existent company', async () => {
    const res = await apiCall('get', '/api/v1/companies/non-existent-slug', {
      cookie: anonymousCookie,
    });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('PUT /api/v1/companies/:slug - admin can update a company', async () => {
    const listRes = await apiCall('get', '/api/v1/companies', { cookie: anonymousCookie });
    const companies = listRes.body.data?.companies ?? [];
    if (companies.length === 0) return;

    const company = companies[0];
    const res = await apiCall('put', `/api/v1/companies/${company.slug}`, {
      cookie: adminCookie,
      body: { description: 'Updated via test' },
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PUT /api/v1/companies/:slug - fails without admin token', async () => {
    const res = await apiCall('put', '/api/v1/companies/some-company', {
      cookie: anonymousCookie,
      body: { description: 'test' },
    });

    expect(res.status).toBe(401);
  });

  it('DELETE /api/v1/companies/:slug - fails without admin token', async () => {
    const res = await apiCall('delete', '/api/v1/companies/some-company', {
      cookie: anonymousCookie,
    });

    expect(res.status).toBe(401);
  });
});
