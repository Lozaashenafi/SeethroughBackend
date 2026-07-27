import { describe, it, expect } from 'vitest';
import { apiCall } from './helpers.js';

describe('Health & Tags & Industries (Public API)', () => {
  it('GET /api/v1/health - returns ok', async () => {
    const res = await apiCall('get', '/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/v1/industries - returns list of industries', async () => {
    const res = await apiCall('get', '/api/v1/industries');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/tags - returns list of tags', async () => {
    const res = await apiCall('get', '/api/v1/tags');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/anonymous/me - creates a new anonymous identity', async () => {
    const res = await apiCall('get', '/api/v1/anonymous/me');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.publicId).toBeDefined();
    // Should set cookies
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'].length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/anonymous/me - returns existing identity with cookie', async () => {
    // First create an identity
    const createRes = await apiCall('get', '/api/v1/anonymous/me');
    const cookie = createRes.headers['set-cookie']?.join('; ') ?? '';

    // Then get it again with the cookie
    const res = await apiCall('get', '/api/v1/anonymous/me', { cookie });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.publicId).toBeDefined();
  });

  it('GET /api/v1/industries - returns valid industry structure', async () => {
    const res = await apiCall('get', '/api/v1/industries');

    expect(res.status).toBe(200);
    const industries = res.body.data;
    if (industries.length > 0) {
      const industry = industries[0];
      expect(industry.id).toBeDefined();
      expect(industry.name).toBeDefined();
      expect(industry.slug).toBeDefined();
    }
  });

  it('GET /api/v1/tags - returns valid tag structure', async () => {
    const res = await apiCall('get', '/api/v1/tags');

    expect(res.status).toBe(200);
    const tags = res.body.data;
    if (tags.length > 0) {
      const tag = tags[0];
      expect(tag.id).toBeDefined();
      expect(tag.name).toBeDefined();
      expect(tag.slug).toBeDefined();
    }
  });
});
