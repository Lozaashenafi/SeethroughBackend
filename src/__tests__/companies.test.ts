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

  it('POST /api/v1/companies - persists a scraped logoUrl', async () => {
    const industriesRes = await apiCall('get', '/api/v1/industries', { cookie: anonymousCookie });
    const industries = industriesRes.body.data ?? [];
    if (industries.length === 0) return;

    const unique = Date.now();
    const slug = `logo-test-${unique}`;
    const logoUrl = 'https://cdn.example.com/logo.png';

    const createRes = await apiCall('post', '/api/v1/companies', {
      cookie: anonymousCookie,
      body: {
        name: `Logo Test ${unique}`,
        slug,
        industryId: industries[0].id,
        website: `https://logo-test-${unique}.example.com`,
        logoUrl,
      },
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.logoUrl).toBe(logoUrl);

    // Persisted — re-fetch and confirm it survives
    const getRes = await apiCall('get', `/api/v1/companies/${slug}`, { cookie: anonymousCookie });
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.logoUrl).toBe(logoUrl);

    // Admin can clear it via update
    const updateRes = await apiCall('put', `/api/v1/companies/${slug}`, {
      cookie: adminCookie,
      body: { logoUrl: null },
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.logoUrl).toBeNull();

    await apiCall('delete', `/api/v1/companies/${slug}`, { cookie: adminCookie });
  });

  it('POST /api/v1/companies - rejects an invalid logoUrl', async () => {
    const industriesRes = await apiCall('get', '/api/v1/industries', { cookie: anonymousCookie });
    const industries = industriesRes.body.data ?? [];
    if (industries.length === 0) return;

    const res = await apiCall('post', '/api/v1/companies', {
      cookie: anonymousCookie,
      body: {
        name: `Bad Logo ${Date.now()}`,
        slug: `bad-logo-${Date.now()}`,
        industryId: industries[0].id,
        logoUrl: 'not-a-url',
      },
    });

    expect(res.status).toBe(400);
  });

  it('GET /api/v1/companies/check - detects an existing website (protocol/www variants)', async () => {
    const industriesRes = await apiCall('get', '/api/v1/industries', { cookie: anonymousCookie });
    const industries = industriesRes.body.data ?? [];
    if (industries.length === 0) return;

    const unique = Date.now();
    const domain = `dupcheck-${unique}.com`;
    const slug = `dup-check-${unique}`;
    await apiCall('post', '/api/v1/companies', {
      cookie: anonymousCookie,
      body: {
        name: `Dup Check ${unique}`,
        slug,
        industryId: industries[0].id,
        website: `https://www.${domain}`,
      },
    });

    // Exact same URL form
    const exactRes = await apiCall('get', '/api/v1/companies/check', {
      cookie: anonymousCookie,
      query: { website: `https://www.${domain}` },
    });
    expect(exactRes.status).toBe(200);
    expect(exactRes.body.data.websiteMatches.some((c: { slug: string }) => c.slug === slug)).toBe(true);

    // Different protocol / missing www — should still match
    const variantRes = await apiCall('get', '/api/v1/companies/check', {
      cookie: anonymousCookie,
      query: { website: domain },
    });
    expect(variantRes.body.data.websiteMatches.some((c: { slug: string }) => c.slug === slug)).toBe(true);

    // Unrelated website — no match
    const missRes = await apiCall('get', '/api/v1/companies/check', {
      cookie: anonymousCookie,
      query: { website: 'totally-unrelated-domain.example' },
    });
    expect(missRes.body.data.websiteMatches.length).toBe(0);

    await apiCall('delete', `/api/v1/companies/${slug}`, { cookie: adminCookie });
  });

  it('GET /api/v1/companies/check - finds companies with similar names', async () => {
    const industriesRes = await apiCall('get', '/api/v1/industries', { cookie: anonymousCookie });
    const industries = industriesRes.body.data ?? [];
    if (industries.length === 0) return;

    const slug = `name-check-${Date.now()}`;
    await apiCall('post', '/api/v1/companies', {
      cookie: anonymousCookie,
      body: {
        name: `Stellar Cloud Systems`,
        slug,
        industryId: industries[0].id,
      },
    });

    const res = await apiCall('get', '/api/v1/companies/check', {
      cookie: anonymousCookie,
      query: { name: 'stellar clouds' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.nameMatches.some((m: { company: { slug: string } }) => m.company.slug === slug)).toBe(true);

    // Completely unrelated name — no matches
    const missRes = await apiCall('get', '/api/v1/companies/check', {
      cookie: anonymousCookie,
      query: { name: 'zzzzz-qwerty-unrelated' },
    });
    expect(missRes.body.data.nameMatches.length).toBe(0);

    await apiCall('delete', `/api/v1/companies/${slug}`, { cookie: adminCookie });
  });

  it('POST /api/v1/companies - hard-blocks creating a company whose website already exists (any URL form)', async () => {
    const industriesRes = await apiCall('get', '/api/v1/industries', { cookie: anonymousCookie });
    const industries = industriesRes.body.data ?? [];
    if (industries.length === 0) return;

    const domain = `blocked-dup-${Date.now()}.com`;
    const ownerSlug = `owner-${Date.now()}`;

    // Create the first company with this website
    const firstRes = await apiCall('post', '/api/v1/companies', {
      cookie: anonymousCookie,
      body: {
        name: `Owner ${Date.now()}`,
        slug: ownerSlug,
        industryId: industries[0].id,
        website: `https://www.${domain}`,
      },
    });
    expect(firstRes.status).toBe(201);

    // Second attempt — same hostname, different URL form + different name/slug
    const dupRes = await apiCall('post', '/api/v1/companies', {
      cookie: anonymousCookie,
      body: {
        name: `Duplicate ${Date.now()}`,
        slug: `dup-${Date.now()}`,
        industryId: industries[0].id,
        website: `https://${domain}/about`, // no www, trailing path
      },
    });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.success).toBe(false);

    // Subdomain of an existing website is also blocked (same site)
    const subRes = await apiCall('post', '/api/v1/companies', {
      cookie: anonymousCookie,
      body: {
        name: `Sub Duplicate ${Date.now()}`,
        slug: `sub-dup-${Date.now()}`,
        industryId: industries[0].id,
        website: `https://shop.${domain}`, // subdomain variant
      },
    });
    expect(subRes.status).toBe(409);

    // Admin cannot reassign the website to another company either
    const otherSlug = `other-${Date.now()}`;
    await apiCall('post', '/api/v1/companies', {
      cookie: anonymousCookie,
      body: {
        name: `Other ${Date.now()}`,
        slug: otherSlug,
        industryId: industries[0].id,
        website: 'https://other-unique-site.com',
      },
    });
    const reassignRes = await apiCall('put', `/api/v1/companies/${otherSlug}`, {
      cookie: adminCookie,
      body: { website: `https://${domain}` },
    });
    expect(reassignRes.status).toBe(409);

    // Cleanup
    await apiCall('delete', `/api/v1/companies/${ownerSlug}`, { cookie: adminCookie });
    await apiCall('delete', `/api/v1/companies/${otherSlug}`, { cookie: adminCookie });
  });

  it('GET /api/v1/companies/check - requires website or name', async () => {
    const res = await apiCall('get', '/api/v1/companies/check', {
      cookie: anonymousCookie,
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/companies/scrape - returns a logoUrl for a real website', async () => {
    const res = await apiCall('post', '/api/v1/companies/scrape', {
      cookie: anonymousCookie,
      body: { website: 'https://example.com' },
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.logoUrl).toBe('string');
    expect(res.body.data.logoUrl.length).toBeGreaterThan(0);
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
