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

  it('DELETE /api/v1/companies/:slug - admin can delete a company with reviews and comments (cascade)', async () => {
    // Fetch a valid industry ID
    const industriesRes = await apiCall('get', '/api/v1/industries', { cookie: anonymousCookie });
    const industries = industriesRes.body.data ?? [];
    if (industries.length === 0) return;
    const industryId = industries[0].id;

    const slug = `cascade-test-${Date.now()}`;

    // Create a company
    const createRes = await apiCall('post', '/api/v1/companies', {
      cookie: anonymousCookie,
      body: {
        name: `Cascade Test ${Date.now()}`,
        slug,
        industryId,
        country: 'Testland',
      },
    });
    expect(createRes.status).toBe(201);

    // Add a review to the company
    const reviewRes = await apiCall('post', '/api/v1/reviews', {
      cookie: anonymousCookie,
      body: {
        companySlug: slug,
        title: 'Cascade delete review',
        pros: 'Good',
        cons: 'Bad',
        overallRating: 4,
        employmentStatus: 'full-time',
        jobTitle: 'Engineer',
      },
    });
    expect(reviewRes.status).toBe(201);
    const reviewPublicId = reviewRes.body.data?.publicId;
    expect(reviewPublicId).toBeDefined();

    // Add a comment to the review
    const commentRes = await apiCall('post', '/api/v1/comments', {
      cookie: anonymousCookie,
      body: { reviewPublicId, content: 'A cascade test comment' },
    });
    expect(commentRes.status).toBe(201);

    // Delete the company as admin — should cascade without FK violations
    const deleteRes = await apiCall('delete', `/api/v1/companies/${slug}`, {
      cookie: adminCookie,
    });

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Company should be gone
    const getRes = await apiCall('get', `/api/v1/companies/${slug}`, {
      cookie: anonymousCookie,
    });
    expect(getRes.status).toBe(404);
  });
});
