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

  const slug = `admin-test-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const res = await apiCall('post', '/api/v1/companies', {
    cookie,
    body: {
      name: `Admin Test ${label} ${Date.now()}`,
      slug,
      industryId,
      country: 'Testland',
    },
  });
  expect(res.status).toBe(201);
  return slug;
}

describe('Admin user management', () => {
  let adminCookie: string;

  beforeAll(async () => {
    const { cookie: anonCookie } = await freshIdentity();

    const loginRes = await apiCall('post', '/api/v1/auth/login', {
      body: { email: 'admin@seethrough.com', password: 'admin123' },
      cookie: anonCookie,
    });
    adminCookie = getAnonymousCookie(loginRes);
  });

  it('admin list search filters by publicId', async () => {
    const { publicId } = await freshIdentity();

    const res = await apiCall('get', '/api/v1/anonymous/admin/list', {
      cookie: adminCookie,
      query: { search: publicId, page: '1', limit: '50' },
    });
    expect(res.status).toBe(200);
    const ids = (res.body.data?.identities ?? []).map((i: { publicId: string }) => i.publicId);
    expect(ids).toContain(publicId);
  });

  it('admin list search filters by nickname', async () => {
    const { cookie, publicId } = await freshIdentity();
    const me = await apiCall('get', '/api/v1/anonymous/me', { cookie });
    const nickname = me.body.data?.nickname as string;
    expect(nickname).toBeDefined();

    const res = await apiCall('get', '/api/v1/anonymous/admin/list', {
      cookie: adminCookie,
      query: { search: nickname.slice(0, 6), page: '1', limit: '50' },
    });
    expect(res.status).toBe(200);
    const ids = (res.body.data?.identities ?? []).map((i: { publicId: string }) => i.publicId);
    expect(ids).toContain(publicId);
  });

  it('admin list search with no matches returns an empty result', async () => {
    const res = await apiCall('get', '/api/v1/anonymous/admin/list', {
      cookie: adminCookie,
      query: { search: `zzz-no-match-${Date.now()}`, page: '1', limit: '50' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.identities).toHaveLength(0);
    expect(res.body.data.pagination.total).toBe(0);
  });

  it('activity endpoint returns 404 for an unknown publicId', async () => {
    const res = await apiCall('get', '/api/v1/anonymous/admin/does-not-exist/activity', {
      cookie: adminCookie,
      query: { page: '1', limit: '20' },
    });
    expect(res.status).toBe(404);
  });

  it('all-reviews endpoint returns every review across all time and statuses', async () => {
    const { cookie, publicId } = await freshIdentity();
    const companySlugA = await createTestCompany(cookie, 'allreva');
    const companySlugB = await createTestCompany(cookie, 'allrevb');

    const first = await apiCall('post', '/api/v1/reviews', {
      cookie,
      body: {
        companySlug: companySlugA,
        title: uniq('All reviews first title'),
        pros: uniq('All reviews first pros'),
        cons: uniq('All reviews first cons'),
        overallRating: 4,
      },
    });
    expect(first.status).toBe(201);
    const firstPublicId = first.body.data.publicId as string;

    const second = await apiCall('post', '/api/v1/reviews', {
      cookie,
      body: {
        companySlug: companySlugB,
        title: uniq('All reviews second title'),
        pros: uniq('All reviews second pros'),
        cons: uniq('All reviews second cons'),
        overallRating: 2,
      },
    });
    expect(second.status).toBe(201);
    const secondPublicId = second.body.data.publicId as string;

    // Reject the second review so it drops out of public view but must stay in admin history.
    const rejectRes = await apiCall('patch', `/api/v1/reviews/admin/${secondPublicId}/status`, {
      cookie: adminCookie,
      body: { status: 'rejected' },
    });
    expect(rejectRes.status).toBe(200);

    const res = await apiCall('get', `/api/v1/anonymous/admin/${publicId}/reviews`, {
      cookie: adminCookie,
    });
    expect(res.status).toBe(200);
    const reviews = res.body.data?.reviews ?? [];
    const found = (pid: string) => reviews.find((r: { publicId: string }) => r.publicId === pid);

    expect(found(firstPublicId)).toBeDefined();
    expect(found(firstPublicId).status).toBe('published');
    expect(found(secondPublicId)).toBeDefined();
    expect(found(secondPublicId).status).toBe('rejected');
    expect(found(firstPublicId).anonymousId).toBeUndefined();
    expect(found(firstPublicId).id).toBeUndefined();

    const missing = await apiCall('get', '/api/v1/anonymous/admin/does-not-exist/reviews', {
      cookie: adminCookie,
    });
    expect(missing.status).toBe(404);
  });

  it('permanently deletes a user and their content; the same browser returns fresh', async () => {
    const { cookie, publicId } = await freshIdentity();
    const companySlug = await createTestCompany(cookie, 'deleteuser');

    const reviewRes = await apiCall('post', '/api/v1/reviews', {
      cookie,
      body: {
        companySlug,
        title: uniq('Delete user review title'),
        pros: uniq('Delete user pros'),
        cons: uniq('Delete user cons'),
        overallRating: 4,
      },
    });
    expect(reviewRes.status).toBe(201);
    const reviewPublicId = reviewRes.body.data.publicId as string;

    const commentRes = await apiCall('post', '/api/v1/comments', {
      cookie,
      body: { reviewPublicId, content: uniq('Delete user comment') },
    });
    expect(commentRes.status).toBe(201);

    const voteRes = await apiCall('post', '/api/v1/votes', {
      cookie,
      body: { reviewPublicId, voteType: 'helpful' },
    });
    expect(voteRes.status).toBe(200);

    const reportRes = await apiCall('post', '/api/v1/reports', {
      cookie,
      body: { reviewPublicId, reason: uniq('Delete user report reason') },
    });
    expect(reportRes.status).toBe(201);

    // Company stats reflect the review before deletion.
    const companyBefore = await apiCall('get', `/api/v1/companies/${companySlug}`, { cookie });
    expect(Number(companyBefore.body.data.reviewCount)).toBe(1);

    // Admin permanently deletes the identity.
    const del = await apiCall('delete', `/api/v1/anonymous/admin/${publicId}`, {
      cookie: adminCookie,
    });
    expect(del.status).toBe(200);

    // Identity is gone from the admin list.
    const list = await apiCall('get', '/api/v1/anonymous/admin/list', {
      cookie: adminCookie,
      query: { search: publicId, page: '1', limit: '50' },
    });
    const ids = (list.body.data?.identities ?? []).map((i: { publicId: string }) => i.publicId);
    expect(ids).not.toContain(publicId);

    // Activity lookup now 404s.
    const activity = await apiCall('get', `/api/v1/anonymous/admin/${publicId}/activity`, {
      cookie: adminCookie,
      query: { page: '1', limit: '20' },
    });
    expect(activity.status).toBe(404);

    // The review (and everything attached to it) is gone from the public API.
    const review = await apiCall('get', `/api/v1/reviews/${reviewPublicId}`, { cookie });
    expect(review.status).toBe(404);

    // Company stats were recomputed after the review disappeared.
    const companyAfter = await apiCall('get', `/api/v1/companies/${companySlug}`, { cookie });
    expect(Number(companyAfter.body.data.reviewCount)).toBe(0);

    // Same browser (old cookie) is minted a BRAND-NEW identity on next visit.
    const revisit = await apiCall('get', '/api/v1/anonymous/me', { cookie });
    expect(revisit.status).toBe(200);
    expect(revisit.body.data.publicId).toBeDefined();
    expect(revisit.body.data.publicId).not.toBe(publicId);
  });

  it('activity aggregates reviews, comments, votes, and reports without leaking internals', async () => {
    const { cookie, publicId } = await freshIdentity();
    const companySlug = await createTestCompany(cookie, 'activity');

    const reviewRes = await apiCall('post', '/api/v1/reviews', {
      cookie,
      body: {
        companySlug,
        title: uniq('Activity test review title'),
        pros: uniq('Activity pros content'),
        cons: uniq('Activity cons content'),
        overallRating: 4,
        employmentStatus: 'full-time',
        jobTitle: 'Engineer',
      },
    });
    expect(reviewRes.status).toBe(201);
    const reviewPublicId = reviewRes.body.data.publicId as string;

    const commentRes = await apiCall('post', '/api/v1/comments', {
      cookie,
      body: {
        reviewPublicId,
        content: uniq('Activity test comment content'),
      },
    });
    expect(commentRes.status).toBe(201);
    const commentPublicId = commentRes.body.data.publicId as string;

    const voteRes = await apiCall('post', '/api/v1/votes', {
      cookie,
      body: { reviewPublicId, voteType: 'helpful' },
    });
    expect(voteRes.status).toBe(200);

    const reportRes = await apiCall('post', '/api/v1/reports', {
      cookie,
      body: {
        reviewPublicId,
        reason: uniq('Activity test report reason'),
        description: 'Automated activity test report',
      },
    });
    expect(reportRes.status).toBe(201);
    const reportPublicId = reportRes.body.data.publicId as string;

    const activity = await apiCall('get', `/api/v1/anonymous/admin/${publicId}/activity`, {
      cookie: adminCookie,
      query: { page: '1', limit: '20' },
    });
    expect(activity.status).toBe(200);
    const data = activity.body.data;

    // Identity summary must never leak the internal id or session token hash.
    expect(data.identity.publicId).toBe(publicId);
    expect(data.identity.sessionTokenHash).toBeUndefined();
    expect(data.identity.id).toBeUndefined();

    expect(data.reviews.pagination.total).toBe(1);
    expect(data.reviews.data[0].publicId).toBe(reviewPublicId);
    expect(data.reviews.data[0].title).toContain('Activity test review title');
    expect(data.reviews.data[0].anonymousId).toBeUndefined();
    expect(data.reviews.data[0].id).toBeUndefined();

    expect(data.comments.pagination.total).toBe(1);
    expect(data.comments.data[0].publicId).toBe(commentPublicId);
    expect(data.comments.data[0].reviewPublicId).toBe(reviewPublicId);
    expect(data.comments.data[0].content).toContain('Activity test comment content');
    expect(data.comments.data[0].anonymousId).toBeUndefined();
    expect(data.comments.data[0].id).toBeUndefined();

    expect(data.votes.pagination.total).toBe(1);
    expect(data.votes.data[0].reviewPublicId).toBe(reviewPublicId);
    expect(data.votes.data[0].voteType).toBe('helpful');

    expect(data.reports.pagination.total).toBe(1);
    expect(data.reports.data[0].publicId).toBe(reportPublicId);
    expect(data.reports.data[0].reviewPublicId).toBe(reviewPublicId);
    expect(data.reports.data[0].reason).toContain('Activity test report reason');
    expect(data.reports.data[0].status).toBe('pending');
  });
});
