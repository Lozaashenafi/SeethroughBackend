import { describe, it, expect, beforeAll } from 'vitest';
import { apiCall } from './helpers.js';

function getAnonymousCookie(res: { headers: Record<string, unknown> }): string {
  const cookies = res.headers['set-cookie'];
  return Array.isArray(cookies) ? cookies.join('; ') : (cookies ?? '');
}

/** Mint a fresh anonymous identity (own cookie pair + own rate-limit budget). */
async function freshIdentity(): Promise<{ cookie: string; publicId: string }> {
  const res = await apiCall('get', '/api/v1/anonymous/me');
  return { cookie: getAnonymousCookie(res), publicId: res.body.data?.publicId };
}

/** Unique per-run content so leftover rows from earlier runs can never collide. */
const uniq = (label: string) => `${label} ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;

async function createTestCompany(cookie: string, label: string): Promise<string> {
  const industriesRes = await apiCall('get', '/api/v1/industries', { cookie });
  const industries = industriesRes.body.data ?? [];
  const industryId = industries[0]?.id;

  const slug = `anon-test-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const res = await apiCall('post', '/api/v1/companies', {
    cookie,
    body: {
      name: `Anon Test ${label} ${Date.now()}`,
      slug,
      industryId,
      country: 'Testland',
    },
  });
  expect(res.status).toBe(201);
  return slug;
}

describe('Anonymous identity behavior', () => {
  let adminCookie: string;

  beforeAll(async () => {
    const { cookie: anonCookie } = await freshIdentity();

    const loginRes = await apiCall('post', '/api/v1/auth/login', {
      body: { email: 'admin@seethrough.com', password: 'admin123' },
      cookie: anonCookie,
    });
    adminCookie = getAnonymousCookie(loginRes);
  });

  it('returns a nickname with the identity', async () => {
    const { cookie } = await freshIdentity();
    const res = await apiCall('get', '/api/v1/anonymous/me', { cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.nickname).toBeDefined();
    expect(typeof res.body.data.nickname).toBe('string');
    // Internal identity must never leak to the client
    expect(res.body.data.sessionTokenHash).toBeUndefined();
    expect(res.body.data.id).toBeUndefined();
  });

  it('regenerates the nickname exactly once', async () => {
    const { cookie } = await freshIdentity();
    const before = await apiCall('get', '/api/v1/anonymous/me', { cookie });
    const originalNickname = before.body.data.nickname;

    const regenRes = await apiCall('patch', '/api/v1/anonymous/me/nickname', { cookie });
    expect(regenRes.status).toBe(200);
    const newNickname = regenRes.body.data.nickname;
    expect(newNickname).toBeDefined();
    expect(newNickname).not.toBe(originalNickname);
    expect(regenRes.body.data.nicknameRegeneratedAt).toBeDefined();

    const secondRes = await apiCall('patch', '/api/v1/anonymous/me/nickname', { cookie });
    expect(secondRes.status).toBe(409);
  });

  it('sets a custom nickname exactly once', async () => {
    const { cookie } = await freshIdentity();

    const setRes = await apiCall('patch', '/api/v1/anonymous/me/nickname', {
      cookie,
      body: { nickname: 'Brave Falcon' },
    });
    expect(setRes.status).toBe(200);
    expect(setRes.body.data.nickname).toBe('Brave Falcon');
    expect(setRes.body.data.nicknameRegeneratedAt).toBeDefined();

    // The one-time budget is now spent — a second change is rejected.
    const second = await apiCall('patch', '/api/v1/anonymous/me/nickname', {
      cookie,
      body: { nickname: 'Silent Owl' },
    });
    expect(second.status).toBe(409);
  });

  it('rejects invalid or oversized custom nicknames', async () => {
    const { cookie } = await freshIdentity();

    // HTML/angle brackets are rejected outright.
    const badChars = await apiCall('patch', '/api/v1/anonymous/me/nickname', {
      cookie,
      body: { nickname: '<script>alert(1)</script>' },
    });
    expect(badChars.status).toBe(400);

    // Over the 30-character limit.
    const tooLong = await apiCall('patch', '/api/v1/anonymous/me/nickname', {
      cookie,
      body: { nickname: 'x'.repeat(31) },
    });
    expect(tooLong.status).toBe(400);
  });

  it('saving the current nickname does not spend the change budget', async () => {
    const { cookie } = await freshIdentity();
    const before = await apiCall('get', '/api/v1/anonymous/me', { cookie });
    const nickname = before.body.data.nickname as string;

    const same = await apiCall('patch', '/api/v1/anonymous/me/nickname', {
      cookie,
      body: { nickname },
    });
    expect(same.status).toBe(200);
    expect(same.body.data.nickname).toBe(nickname);
    expect(same.body.data.nicknameRegeneratedAt).toBeNull();

    // Budget still available — a real change works afterwards.
    const change = await apiCall('patch', '/api/v1/anonymous/me/nickname', {
      cookie,
      body: { nickname: 'Midnight Raven' },
    });
    expect(change.status).toBe(200);
    expect(change.body.data.nickname).toBe('Midnight Raven');
  });

  it('rejects a second review for the same company within 30 days', async () => {
    const { cookie } = await freshIdentity();
    const companySlug = await createTestCompany(cookie, 'repeat');

    const first = await apiCall('post', '/api/v1/reviews', {
      cookie,
      body: {
        companySlug,
        title: uniq('First unique review title'),
        pros: uniq('Loved the team and culture'),
        cons: uniq('Nothing major to complain about'),
        overallRating: 4,
        employmentStatus: 'full-time',
        jobTitle: 'Engineer',
      },
    });
    expect(first.status).toBe(201);

    const second = await apiCall('post', '/api/v1/reviews', {
      cookie,
      body: {
        companySlug,
        title: uniq('A different second title'),
        pros: uniq('Perfectly fine experience'),
        cons: uniq('No complaints at all'),
        overallRating: 3,
        employmentStatus: 'full-time',
        jobTitle: 'Engineer',
      },
    });
    expect(second.status).toBe(409);
    expect(second.body.success).toBe(false);
  });

  it('rejects an exact duplicate of previously posted content', async () => {
    const { cookie } = await freshIdentity();
    const companySlug = await createTestCompany(cookie, 'dup');
    const title = uniq('Exact duplicate title');
    const pros = uniq('Identical pros paragraph');
    const cons = uniq('Identical cons paragraph');

    const first = await apiCall('post', '/api/v1/reviews', {
      cookie,
      body: { companySlug, title, pros, cons, overallRating: 4 },
    });
    expect(first.status).toBe(201);

    const dupSlug = await createTestCompany(cookie, 'dupb');
    const second = await apiCall('post', '/api/v1/reviews', {
      cookie,
      body: { companySlug: dupSlug, title, pros, cons, overallRating: 4 },
    });
    expect(second.status).toBe(409);
  });

  it('temp-blocks an identity from posting reviews until lifted', async () => {
    const { cookie, publicId } = await freshIdentity();
    const companySlug = await createTestCompany(cookie, 'blocked');

    const tempBlockRes = await apiCall(
      'patch',
      `/api/v1/anonymous/admin/${publicId}/temp-block`,
      { cookie: adminCookie, body: { hours: 24 } },
    );
    expect(tempBlockRes.status).toBe(200);

    const post = await apiCall('post', '/api/v1/reviews', {
      cookie,
      body: {
        companySlug,
        title: uniq('Blocked identity should not post'),
        pros: uniq('Pros while blocked'),
        cons: uniq('Cons while blocked'),
        overallRating: 2,
      },
    });
    expect(post.status).toBe(429);
    expect(post.body.success).toBe(false);

    const clearRes = await apiCall(
      'patch',
      `/api/v1/anonymous/admin/${publicId}/clear-temp-block`,
      { cookie: adminCookie },
    );
    expect(clearRes.status).toBe(200);

    const after = await apiCall('post', '/api/v1/reviews', {
      cookie,
      body: {
        companySlug,
        title: uniq('Allowed after restriction lifted'),
        pros: uniq('Pros after lifting'),
        cons: uniq('Cons after lifting'),
        overallRating: 3,
      },
    });
    expect(after.status).toBe(201);
  });

  it('moderates a review to rejected and published via admin endpoints', async () => {
    const { cookie } = await freshIdentity();
    const companySlug = await createTestCompany(cookie, 'mod');

    const create = await apiCall('post', '/api/v1/reviews', {
      cookie,
      body: {
        companySlug,
        title: uniq('Moderation candidate'),
        pros: uniq('Genuinely positive experience here'),
        cons: uniq('A few minor growing pains'),
        overallRating: 3,
        employmentStatus: 'full-time',
        jobTitle: 'Dev',
      },
    });
    expect(create.status).toBe(201);
    const reviewPublicId = create.body.data.publicId;
    expect(reviewPublicId).toBeDefined();
    expect(create.body.data.status).toBe('published');

    const publicGet = await apiCall('get', `/api/v1/reviews/${reviewPublicId}`, { cookie });
    expect(publicGet.status).toBe(200);

    const rejectRes = await apiCall('patch', `/api/v1/reviews/admin/${reviewPublicId}/status`, {
      cookie: adminCookie,
      body: { status: 'rejected' },
    });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('rejected');

    const hiddenGet = await apiCall('get', `/api/v1/reviews/${reviewPublicId}`, { cookie });
    expect(hiddenGet.status).toBe(404);

    const adminList = await apiCall('get', '/api/v1/reviews/admin/all', {
      cookie: adminCookie,
      query: { status: 'rejected', page: '1', limit: '50' },
    });
    expect(adminList.status).toBe(200);
    const rejected = (adminList.body.data?.reviews ?? []).find(
      (r: { publicId: string }) => r.publicId === reviewPublicId,
    );
    expect(rejected).toBeDefined();

    const approveRes = await apiCall('patch', `/api/v1/reviews/admin/${reviewPublicId}/status`, {
      cookie: adminCookie,
      body: { status: 'published' },
    });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('published');

    const visibleAgain = await apiCall('get', `/api/v1/reviews/${reviewPublicId}`, { cookie });
    expect(visibleAgain.status).toBe(200);
  });
});
