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

  const slug = `profile-test-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const res = await apiCall('post', '/api/v1/companies', {
    cookie,
    body: {
      name: `Profile Test ${label} ${Date.now()}`,
      slug,
      industryId,
      country: 'Testland',
    },
  });
  expect(res.status).toBe(201);
  return slug;
}

async function createReview(cookie: string, companySlug: string, title: string, overallRating = 4) {
  const res = await apiCall('post', '/api/v1/reviews', {
    cookie,
    body: {
      companySlug,
      title,
      pros: uniq('Profile test pros'),
      cons: uniq('Profile test cons'),
      overallRating,
      workLifeBalance: overallRating,
      culture: overallRating,
      management: overallRating,
      compensation: overallRating,
      opportunities: overallRating,
      employmentStatus: 'full-time',
      jobTitle: 'Engineer',
    },
  });
  expect(res.status).toBe(201);
  return res.body.data;
}

describe('Anonymous profile — own reviews & review editing', () => {
  let adminCookie: string;

  beforeAll(async () => {
    const { cookie: anonCookie } = await freshIdentity();
    const loginRes = await apiCall('post', '/api/v1/auth/login', {
      body: { email: 'admin@seethrough.com', password: 'admin123' },
      cookie: anonCookie,
    });
    adminCookie = getAnonymousCookie(loginRes);
  });

  it('GET /anonymous/me/reviews/:publicId returns one own review; 404 for others', async () => {
    const { cookie } = await freshIdentity();
    const other = await freshIdentity();
    const companySlug = await createTestCompany(cookie, 'ownreview');

    const review = await createReview(cookie, companySlug, uniq('Own single review title'));

    const mine = await apiCall('get', `/api/v1/anonymous/me/reviews/${review.publicId}`, { cookie });
    expect(mine.status).toBe(200);
    expect(mine.body.data.publicId).toBe(review.publicId);
    expect(mine.body.data.id).toBeUndefined();

    // Someone else's cookie can never fetch it.
    const theirs = await apiCall('get', `/api/v1/anonymous/me/reviews/${review.publicId}`, {
      cookie: other.cookie,
    });
    expect(theirs.status).toBe(404);
  });

  it('GET /anonymous/me/reviews returns only the caller\'s reviews', async () => {
    const { cookie } = await freshIdentity();
    const other = await freshIdentity();

    const companySlug = await createTestCompany(cookie, 'ownreviews');
    const review = await createReview(cookie, companySlug, uniq('Own reviews title'));
    // Another identity posts to the same company — must not leak into /me/reviews.
    await createReview(other.cookie, companySlug, uniq('Other identity title'));

    const res = await apiCall('get', '/api/v1/anonymous/me/reviews', {
      cookie,
      query: { page: '1', limit: '20' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.pagination.total).toBe(1);
    expect(res.body.data.reviews[0].publicId).toBe(review.publicId);
    expect(res.body.data.reviews[0].title).toContain('Own reviews title');
    // Internal ids never leak.
    expect(res.body.data.reviews[0].id).toBeUndefined();
    expect(res.body.data.reviews[0].anonymousId).toBeUndefined();
  });

  it('author edits their own review and company stats are recomputed', async () => {
    const { cookie } = await freshIdentity();
    const companySlug = await createTestCompany(cookie, 'editstats');

    const review = await createReview(cookie, companySlug, uniq('Edit stats title'), 5);

    const before = await apiCall('get', `/api/v1/companies/${companySlug}`, { cookie });
    expect(Number(before.body.data.averageRating)).toBe(5);

    const res = await apiCall('put', `/api/v1/reviews/${review.publicId}`, {
      cookie,
      body: {
        title: uniq('Edit stats title v2'),
        pros: uniq('Edit pros v2'),
        overallRating: 1,
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toContain('Edit stats title v2');
    expect(res.body.data.overallRating).toBe(1);
    expect(res.body.data.status).toBe('published');

    const after = await apiCall('get', `/api/v1/companies/${companySlug}`, { cookie });
    expect(Number(after.body.data.averageRating)).toBe(1);
  });

  it('a third party cannot edit someone else\'s review (404, no leak)', async () => {
    const { cookie } = await freshIdentity();
    const attacker = await freshIdentity();
    const companySlug = await createTestCompany(cookie, 'editdeny');

    const review = await createReview(cookie, companySlug, uniq('Edit deny title'));

    const res = await apiCall('put', `/api/v1/reviews/${review.publicId}`, {
      cookie: attacker.cookie,
      body: { title: uniq('Hacked title') },
    });
    expect(res.status).toBe(404);

    // The original is untouched.
    const check = await apiCall('get', `/api/v1/reviews/${review.publicId}`, { cookie });
    expect(check.body.data.title).toContain('Edit deny title');
  });

  it('editing with an out-of-range rating is rejected with 400', async () => {
    const { cookie } = await freshIdentity();
    const companySlug = await createTestCompany(cookie, 'editrating');

    const review = await createReview(cookie, companySlug, uniq('Edit rating title'));

    const res = await apiCall('put', `/api/v1/reviews/${review.publicId}`, {
      cookie,
      body: { overallRating: 6 },
    });
    expect(res.status).toBe(400);
  });

  it('a rejected review stays visible to its author in /me/reviews, can be edited, and stays hidden publicly', async () => {
    const { cookie, publicId } = await freshIdentity();
    const companySlug = await createTestCompany(cookie, 'editrejected');

    const review = await createReview(cookie, companySlug, uniq('Rejected edit title'));

    const reject = await apiCall('patch', `/api/v1/reviews/admin/${review.publicId}/status`, {
      cookie: adminCookie,
      body: { status: 'rejected' },
    });
    expect(reject.status).toBe(200);

    // Hidden from the public feed but present in the author's own list.
    const pub = await apiCall('get', `/api/v1/reviews/${review.publicId}`, { cookie });
    expect(pub.status).toBe(404);

    const mine = await apiCall('get', '/api/v1/anonymous/me/reviews', {
      cookie,
      query: { page: '1', limit: '20' },
    });
    expect(mine.status).toBe(200);
    const mineRejected = (mine.body.data.reviews as Array<{ publicId: string; status: string }>).find(
      (r) => r.publicId === review.publicId,
    );
    expect(mineRejected).toBeDefined();
    expect(mineRejected!.status).toBe('rejected');

    // The author may still edit it; it remains rejected until an admin re-approves.
    const edit = await apiCall('put', `/api/v1/reviews/${review.publicId}`, {
      cookie,
      body: { title: uniq('Rejected edit title v2') },
    });
    expect(edit.status).toBe(200);
    expect(edit.body.data.status).toBe('rejected');

    const pubAfter = await apiCall('get', `/api/v1/reviews/${review.publicId}`, { cookie });
    expect(pubAfter.status).toBe(404);
    expect(publicId).toBeTruthy();

    // The author-scoped deep link returns it (edit page prefill), and the
    // author can also read its tags even though it is not published.
    const deepLink = await apiCall('get', `/api/v1/anonymous/me/reviews/${review.publicId}`, {
      cookie,
    });
    expect(deepLink.status).toBe(200);
    expect(deepLink.body.data.status).toBe('rejected');

    const tagsInfo = await apiCall('get', '/api/v1/tags', { cookie });
    const firstTag = tagsInfo.body.data?.[0]?.id;
    if (firstTag) {
      const attach = await apiCall('put', `/api/v1/reviews/${review.publicId}`, {
        cookie,
        body: { tagIds: [firstTag] },
      });
      expect(attach.status).toBe(200);
      const readTags = await apiCall('get', `/api/v1/reviews/${review.publicId}/tags`, { cookie });
      expect(readTags.status).toBe(200);
      expect(readTags.body.data.tagIds).toContain(firstTag);

      // A third party cannot read tags of a non-published review.
      const other = await freshIdentity();
      const hidden = await apiCall('get', `/api/v1/reviews/${review.publicId}/tags`, {
        cookie: other.cookie,
      });
      expect(hidden.status).toBe(404);
    }
  });

  it('review tags can be read and replaced by the author', async () => {
    const { cookie } = await freshIdentity();
    const companySlug = await createTestCompany(cookie, 'edittags');

    const tagsRes = await apiCall('get', '/api/v1/tags', { cookie });
    const tags = tagsRes.body.data ?? [];
    expect(tags.length).toBeGreaterThanOrEqual(2);
    const [tagA, tagB] = tags.map((t: { id: number }) => t.id);

    const review = await createReview(cookie, companySlug, uniq('Edit tags title'));
    const attach = await apiCall('put', `/api/v1/reviews/${review.publicId}`, {
      cookie,
      body: { tagIds: [tagA] },
    });
    expect(attach.status).toBe(200);

    const read = await apiCall('get', `/api/v1/reviews/${review.publicId}/tags`, { cookie });
    expect(read.status).toBe(200);
    expect(read.body.data.tagIds).toEqual([tagA]);

    const replace = await apiCall('put', `/api/v1/reviews/${review.publicId}`, {
      cookie,
      body: { tagIds: [tagB] },
    });
    expect(replace.status).toBe(200);

    const readAfter = await apiCall('get', `/api/v1/reviews/${review.publicId}/tags`, { cookie });
    expect(readAfter.body.data.tagIds).toEqual([tagB]);
  });
});
