import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { apiCall } from './helpers.js';
import { pool } from '../database/db.js';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './setup.js';

// ─── Helpers ───

// Rate limiters key on req.ip, and the whole suite shares one loopback address.
// Each test therefore runs as its own synthetic client IP (honoured because
// the app trusts one proxy hop), so one test can never exhaust another's
// login / review / comment budget.
let currentIp = '10.42.0.1';

function nextIp(): void {
  const parts = currentIp.split('.');
  currentIp = `${parts[0]}.${parts[1]}.${parts[2]}.${Number(parts[3]) + 1}`;
}

function api(
  method: Parameters<typeof apiCall>[0],
  url: string,
  options: Parameters<typeof apiCall>[2] = {},
) {
  return apiCall(method, url, {
    ...options,
    headers: { ...options.headers, 'X-Forwarded-For': currentIp },
  });
}

function cookieOf(res: { headers: Record<string, unknown> }): string {
  const cookies = res.headers['set-cookie'];
  return Array.isArray(cookies) ? cookies.join('; ') : String(cookies ?? '');
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await api('post', '/api/v1/user/login', {
    body: { email, password },
  });
  expect(res.status).toBe(200);
  return cookieOf(res);
}

/** Unique per-run content so leftover rows from earlier runs can never collide. */
const uniq = (label: string) => `${label} ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;

const createdUserIds: string[] = [];

/**
 * Create a real user row directly, so tests control email verification and
 * moderation state without going through the email-verification flow.
 */
async function createUser(
  label: string,
  options: { verified?: boolean; blocked?: boolean; tempBlockedUntil?: Date } = {},
): Promise<{ id: string; email: string; displayName: string; cookie: string }> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@adminusers.test`;
  const password = 'Password123!';
  const displayName = `Admin Test ${label}`;
  const passwordHash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, display_name, role, email_verified, is_blocked, temp_blocked_until)
     VALUES ($1, $2, $3, 'user', $4, $5, $6)
     RETURNING id`,
    [
      email,
      passwordHash,
      displayName,
      options.verified ?? true,
      options.blocked ?? false,
      options.tempBlockedUntil ?? null,
    ],
  );
  const id = rows[0]!.id;
  createdUserIds.push(id);

  return { id, email, displayName, cookie: await loginAs(email, password) };
}

async function createCompany(cookie: string, label: string): Promise<string> {
  const industriesRes = await api('get', '/api/v1/industries', { cookie });
  const industryId = industriesRes.body.data?.[0]?.id;
  expect(industryId).toBeDefined();

  const slug = `admin-users-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const res = await api('post', '/api/v1/companies', {
    cookie,
    body: {
      name: `Admin Users ${label} ${Date.now()}`,
      slug,
      industryId,
      country: 'Testland',
    },
  });
  expect(res.status).toBe(201);
  return slug;
}

async function countUserRows(userId: string) {
  const { rows } = await pool.query<{
    reviews: string;
    comments: string;
    votes: string;
    reports: string;
  }>(
    `SELECT
       (SELECT count(*) FROM reviews WHERE user_id = $1) AS reviews,
       (SELECT count(*) FROM comments WHERE user_id = $1) AS comments,
       (SELECT count(*) FROM review_votes WHERE user_id = $1) AS votes,
       (SELECT count(*) FROM reports WHERE user_id = $1) AS reports`,
    [userId],
  );
  const row = rows[0]!;
  return {
    reviews: Number(row.reviews),
    comments: Number(row.comments),
    votes: Number(row.votes),
    reports: Number(row.reports),
  };
}

// ─── Tests ───

describe('Admin user management', () => {
  let adminCookie: string;
  let adminId: string;

  beforeAll(async () => {
    adminCookie = await loginAs(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [TEST_ADMIN_EMAIL],
    );
    adminId = rows[0]!.id;
  });

  afterAll(async () => {
    // Remove the accounts this file created (and any content still attached).
    for (const id of createdUserIds) {
      await api('delete', `/api/v1/user/admin/users/${id}`, { cookie: adminCookie });
    }
  });

  it('rejects anonymous and non-admin callers', async () => {
    nextIp();
    const anonymous = await api('get', '/api/v1/user/admin/users');
    expect(anonymous.status).toBe(401);

    const user = await createUser('nonadmin');
    const asUser = await api('get', '/api/v1/user/admin/users', { cookie: user.cookie });
    expect(asUser.status).toBe(403);
    expect(asUser.body.message).toContain('Admin access required');
  });

  it('lists users with pagination and searches by email and display name', async () => {
    nextIp();
    const user = await createUser('list');

    const byEmail = await api('get', '/api/v1/user/admin/users', {
      cookie: adminCookie,
      query: { search: user.email, page: '1', limit: '10' },
    });
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.data.users.map((u: { id: string }) => u.id)).toContain(user.id);
    expect(byEmail.body.data.pagination).toMatchObject({ page: 1, limit: 10, total: 1 });

    const byName = await api('get', '/api/v1/user/admin/users', {
      cookie: adminCookie,
      query: { search: user.displayName.slice(0, 12), limit: '50' },
    });
    expect(byName.status).toBe(200);
    expect(byName.body.data.users.map((u: { id: string }) => u.id)).toContain(user.id);

    const noMatch = await api('get', '/api/v1/user/admin/users', {
      cookie: adminCookie,
      query: { search: `zzz-no-match-${Date.now()}`, limit: '50' },
    });
    expect(noMatch.status).toBe(200);
    expect(noMatch.body.data.users).toHaveLength(0);
    expect(noMatch.body.data.pagination.total).toBe(0);
  });

  it('filters users by role and moderation status', async () => {
    nextIp();
    const blocked = await createUser('filter-blocked', { blocked: true });
    const restricted = await createUser('filter-restricted', {
      tempBlockedUntil: new Date(Date.now() + 60 * 60 * 1000),
    });

    const blockedList = await api('get', '/api/v1/user/admin/users', {
      cookie: adminCookie,
      query: { status: 'blocked', limit: '100' },
    });
    expect(blockedList.status).toBe(200);
    const blockedIds = blockedList.body.data.users.map((u: { id: string }) => u.id);
    expect(blockedIds).toContain(blocked.id);
    expect(blockedIds).not.toContain(restricted.id);

    const restrictedList = await api('get', '/api/v1/user/admin/users', {
      cookie: adminCookie,
      query: { status: 'restricted', limit: '100' },
    });
    const restrictedIds = restrictedList.body.data.users.map((u: { id: string }) => u.id);
    expect(restrictedIds).toContain(restricted.id);
    expect(restrictedIds).not.toContain(blocked.id);

    const adminList = await api('get', '/api/v1/user/admin/users', {
      cookie: adminCookie,
      query: { role: 'admin', limit: '100' },
    });
    expect(adminList.body.data.users.every((u: { role: string }) => u.role === 'admin')).toBe(true);
    expect(adminList.body.data.users.map((u: { id: string }) => u.id)).toContain(adminId);
  });

  it('returns user detail without leaking credentials, and 400/404 for bad ids', async () => {
    nextIp();
    const user = await createUser('detail');

    const res = await api('get', `/api/v1/user/admin/users/${user.id}`, { cookie: adminCookie });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: 'user',
      emailVerified: true,
      isBlocked: false,
    });
    expect(res.body.data.counts).toEqual({ reviews: 0, comments: 0, votes: 0, reports: 0 });

    // Secrets must never travel to the admin UI.
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.body.data.googleId).toBeUndefined();
    expect(res.body.data.verificationToken).toBeUndefined();
    expect(res.body.data.resetToken).toBeUndefined();

    const missing = await api('get', '/api/v1/user/admin/users/00000000-0000-4000-8000-000000000000', {
      cookie: adminCookie,
    });
    expect(missing.status).toBe(404);

    const malformed = await api('get', '/api/v1/user/admin/users/not-a-uuid', { cookie: adminCookie });
    expect(malformed.status).toBe(400);
  });

  it('blocks a user so they cannot post, and unblocking restores access', async () => {
    nextIp();
    const user = await createUser('block');
    const slug = await createCompany(user.cookie, 'block');
    const reviewRes = await api('post', '/api/v1/reviews', {
      cookie: user.cookie,
      body: {
        companySlug: slug,
        title: uniq('Block test review'),
        pros: uniq('Block test pros'),
        cons: uniq('Block test cons'),
        overallRating: 3,
      },
    });
    expect(reviewRes.status).toBe(201);
    const reviewPublicId = reviewRes.body.data.publicId as string;

    const postComment = () =>
      apiCall('post', '/api/v1/comments', {
        cookie: user.cookie,
        body: { reviewPublicId, content: uniq('Block test comment') },
      });

    expect((await postComment()).status).toBe(201);

    const blockedRes = await api('patch', `/api/v1/user/admin/users/${user.id}/block`, {
      cookie: adminCookie,
    });
    expect(blockedRes.status).toBe(200);
    expect(blockedRes.body.data.isBlocked).toBe(true);

    const blockedComment = await postComment();
    expect(blockedComment.status).toBe(403);
    expect(blockedComment.body.message).toContain('blocked');

    const blockedVote = await api('post', '/api/v1/votes', {
      cookie: user.cookie,
      body: { reviewPublicId, voteType: 'helpful' },
    });
    expect(blockedVote.status).toBe(403);

    // Blocking twice is a conflict, and blocking yourself is refused outright.
    expect((await api('patch', `/api/v1/user/admin/users/${user.id}/block`, { cookie: adminCookie })).status).toBe(409);
    const self = await api('patch', `/api/v1/user/admin/users/${adminId}/block`, { cookie: adminCookie });
    expect(self.status).toBe(400);
    expect(self.body.message).toContain('your own account');

    const unblocked = await api('patch', `/api/v1/user/admin/users/${user.id}/unblock`, {
      cookie: adminCookie,
    });
    expect(unblocked.status).toBe(200);
    expect(unblocked.body.data.isBlocked).toBe(false);

    expect((await postComment()).status).toBe(201);
  });

  it('temporarily restricts a user until the window expires or is lifted', async () => {
    nextIp();
    const user = await createUser('restrict');
    const slug = await createCompany(user.cookie, 'restrict');
    const reviewRes = await api('post', '/api/v1/reviews', {
      cookie: user.cookie,
      body: {
        companySlug: slug,
        title: uniq('Restrict test review'),
        pros: uniq('Restrict test pros'),
        cons: uniq('Restrict test cons'),
        overallRating: 4,
      },
    });
    expect(reviewRes.status).toBe(201);
    const reviewPublicId = reviewRes.body.data.publicId as string;

    const postComment = () =>
      apiCall('post', '/api/v1/comments', {
        cookie: user.cookie,
        body: { reviewPublicId, content: uniq('Restrict test comment') },
      });

    const restricted = await api('patch', `/api/v1/user/admin/users/${user.id}/temp-block`, {
      cookie: adminCookie,
      body: { hours: 24 },
    });
    expect(restricted.status).toBe(200);
    expect(restricted.body.data.tempBlockedUntil).toBeTruthy();

    const denied = await postComment();
    expect(denied.status).toBe(403);
    expect(denied.body.message).toContain('temporarily restricted');

    // A restriction is self-expiring: push the window into the past and the
    // user can post again without any admin action.
    await pool.query('UPDATE users SET temp_blocked_until = now() - interval \'1 minute\' WHERE id = $1', [user.id]);
    expect((await postComment()).status).toBe(201);

    // ...and an active window can be lifted early.
    await api('patch', `/api/v1/user/admin/users/${user.id}/temp-block`, {
      cookie: adminCookie,
      body: { hours: 24 },
    });
    const lifted = await api('patch', `/api/v1/user/admin/users/${user.id}/clear-temp-block`, {
      cookie: adminCookie,
    });
    expect(lifted.status).toBe(200);
    expect(lifted.body.data.tempBlockedUntil).toBeNull();
    expect((await postComment()).status).toBe(201);
  });

  it('aggregates a user activity feed without leaking internals', async () => {
    nextIp();
    const user = await createUser('activity');
    const slug = await createCompany(user.cookie, 'activity');
    const reviewRes = await api('post', '/api/v1/reviews', {
      cookie: user.cookie,
      body: {
        companySlug: slug,
        title: uniq('Activity test review'),
        pros: uniq('Activity test pros'),
        cons: uniq('Activity test cons'),
        overallRating: 4,
        employmentStatus: 'full-time',
        jobTitle: 'Engineer',
      },
    });
    expect(reviewRes.status).toBe(201);
    const reviewPublicId = reviewRes.body.data.publicId as string;

    const commentRes = await api('post', '/api/v1/comments', {
      cookie: user.cookie,
      body: { reviewPublicId, content: uniq('Activity test comment') },
    });
    expect(commentRes.status).toBe(201);
    const commentPublicId = commentRes.body.data.publicId as string;

    expect((await api('post', '/api/v1/votes', {
      cookie: user.cookie,
      body: { reviewPublicId, voteType: 'helpful' },
    })).status).toBe(200);

    const reportRes = await api('post', '/api/v1/reports', {
      cookie: user.cookie,
      body: { reviewPublicId, reason: uniq('Activity test report reason') },
    });
    expect(reportRes.status).toBe(201);
    const reportPublicId = reportRes.body.data.publicId as string;

    const activity = await api('get', `/api/v1/user/admin/users/${user.id}/activity`, {
      cookie: adminCookie,
      query: { page: '1', limit: '20' },
    });
    expect(activity.status).toBe(200);
    const data = activity.body.data;

    expect(data.user.id).toBe(user.id);
    expect(data.user.passwordHash).toBeUndefined();
    expect(data.user.googleId).toBeUndefined();

    expect(data.reviews.pagination.total).toBe(1);
    expect(data.reviews.data[0].publicId).toBe(reviewPublicId);
    // Internal columns are mapped away by toReviewResponse.
    expect(data.reviews.data[0].id).toBeUndefined();
    expect(data.reviews.data[0].userId).toBeUndefined();

    expect(data.comments.pagination.total).toBe(1);
    expect(data.comments.data[0].publicId).toBe(commentPublicId);
    expect(data.comments.data[0].reviewPublicId).toBe(reviewPublicId);
    expect(data.comments.data[0].userId).toBeUndefined();

    expect(data.votes.pagination.total).toBe(1);
    expect(data.votes.data[0].voteType).toBe('helpful');
    expect(data.votes.data[0].reviewTitle).toContain('Activity test review');

    expect(data.reports.pagination.total).toBe(1);
    expect(data.reports.data[0].publicId).toBe(reportPublicId);
    expect(data.reports.data[0].status).toBe('pending');

    // The detail view reports the same totals.
    const detail = await api('get', `/api/v1/user/admin/users/${user.id}`, { cookie: adminCookie });
    expect(detail.body.data.counts).toEqual({ reviews: 1, comments: 1, votes: 1, reports: 1 });

    const allReviews = await api('get', `/api/v1/user/admin/users/${user.id}/reviews`, {
      cookie: adminCookie,
    });
    expect(allReviews.status).toBe(200);
    expect(allReviews.body.data.reviews.map((r: { publicId: string }) => r.publicId)).toContain(reviewPublicId);

    const missingActivity = await api('get', '/api/v1/user/admin/users/00000000-0000-4000-8000-000000000000/activity', {
      cookie: adminCookie,
    });
    expect(missingActivity.status).toBe(404);
  });

  it('permanently deletes a user with their content and recomputes company stats', async () => {
    nextIp();
    const user = await createUser('delete');
    const slug = await createCompany(user.cookie, 'delete');
    const reviewRes = await api('post', '/api/v1/reviews', {
      cookie: user.cookie,
      body: {
        companySlug: slug,
        title: uniq('Delete test review'),
        pros: uniq('Delete test pros'),
        cons: uniq('Delete test cons'),
        overallRating: 4,
      },
    });
    expect(reviewRes.status).toBe(201);
    expect(reviewRes.body.data.status).toBe('published');
    const reviewPublicId = reviewRes.body.data.publicId as string;

    const commentRes = await api('post', '/api/v1/comments', {
      cookie: user.cookie,
      body: { reviewPublicId, content: uniq('Delete test comment') },
    });
    expect(commentRes.status).toBe(201);
    expect((await api('post', '/api/v1/votes', {
      cookie: user.cookie,
      body: { reviewPublicId, voteType: 'helpful' },
    })).status).toBe(200);
    expect((await api('post', '/api/v1/reports', {
      cookie: user.cookie,
      body: { reviewPublicId, reason: uniq('Delete test report reason') },
    })).status).toBe(201);

    expect(await countUserRows(user.id)).toEqual({ reviews: 1, comments: 1, votes: 1, reports: 1 });

    const before = await api('get', `/api/v1/companies/${slug}`);
    expect(Number(before.body.data.reviewCount)).toBe(1);

    const totalBefore = Number(
      (await pool.query<{ total: string }>('SELECT count(*) AS total FROM reviews')).rows[0]!.total,
    );

    const del = await api('delete', `/api/v1/user/admin/users/${user.id}`, { cookie: adminCookie });
    expect(del.status).toBe(200);

    // Account gone: no detail, no activity, nothing in the list.
    expect((await api('get', `/api/v1/user/admin/users/${user.id}`, { cookie: adminCookie })).status).toBe(404);
    expect((await api('get', `/api/v1/user/admin/users/${user.id}/activity`, { cookie: adminCookie })).status).toBe(404);
    const search = await api('get', '/api/v1/user/admin/users', {
      cookie: adminCookie,
      query: { search: user.email, limit: '10' },
    });
    expect(search.body.data.users).toHaveLength(0);

    // Content gone: the review 404s publicly and no rows are left behind.
    expect((await api('get', `/api/v1/reviews/${reviewPublicId}`)).status).toBe(404);
    expect(await countUserRows(user.id)).toEqual({ reviews: 0, comments: 0, votes: 0, reports: 0 });

    const companyAfter = await api('get', `/api/v1/companies/${slug}`);
    expect(Number(companyAfter.body.data.reviewCount)).toBe(0);
    expect(companyAfter.body.data.averageRating === null || Number(companyAfter.body.data.averageRating) === 0).toBe(true);

    // Exactly one review disappeared — other users' content is untouched.
    const totalAfter = Number(
      (await pool.query<{ total: string }>('SELECT count(*) AS total FROM reviews')).rows[0]!.total,
    );
    expect(totalAfter).toBe(totalBefore - 1);

    // An admin cannot delete their own account either.
    const selfDelete = await api('delete', `/api/v1/user/admin/users/${adminId}`, { cookie: adminCookie });
    expect(selfDelete.status).toBe(400);
  });
});
