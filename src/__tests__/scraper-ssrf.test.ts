import { describe, it, expect } from 'vitest';
import { apiCall } from './helpers.js';

describe('Company scraper SSRF protection', () => {
  const blockedUrls = [
    { label: 'IPv4 loopback', url: 'http://127.0.0.1' },
    { label: 'IPv4 private (10.x)', url: 'http://10.0.0.1' },
    { label: 'IPv4 private (172.16-31)', url: 'http://172.20.10.1' },
    { label: 'IPv4 private (192.168)', url: 'http://192.168.1.1' },
    { label: 'cloud metadata link-local', url: 'http://169.254.169.254/latest/meta-data/' },
    { label: 'localhost hostname', url: 'http://localhost' },
    { label: 'IPv4-mapped IPv6 loopback', url: 'http://[::ffff:127.0.0.1]' },
    { label: 'IPv6 loopback', url: 'http://[::1]' },
  ];

  for (const { label, url } of blockedUrls) {
    it(`blocks ${label}`, async () => {
      const res = await apiCall('post', '/api/v1/companies/scrape', { body: { website: url } });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  }

  it('blocks redirects to internal addresses', async () => {
    const res = await apiCall('post', '/api/v1/companies/scrape', {
      body: { website: 'https://httpbingo.org/redirect-to?url=http://127.0.0.1/' },
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects non-http(s) schemes', async () => {
    for (const url of ['ftp://example.com', 'file:///etc/passwd']) {
      const res = await apiCall('post', '/api/v1/companies/scrape', { body: { website: url } });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }
  });
});
