import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../database/db.js';
import { reviewsRepository } from '../modules/reviews/repository/reviews.repository.js';
import { companiesRepository } from '../modules/companies/repository/companies.repository.js';
import { apiCall } from './helpers.js';

/**
 * Company stats — which reviews are allowed to move the numbers on a company
 * page, and how "Recommended %" is derived.
 *
 * Reviews are inserted straight into the database because the HTTP harness
 * cannot create a company: `POST /api/v1/companies` requires a real (non-guest)
 * account, and this suite has no registration helper. That is also the only way
 * to control stored `status` and category ratings precisely.
 *
 * Company stats are *denormalized* — the number on a company page is the stored
 * column, recomputed by the API whenever a review is created, edited, moderated
 * or deleted, never on read. So after seeding rows the suite runs that same
 * recompute once (`recomputeCompanyStats`, the identical pair of calls every
 * service makes) and then asserts on what the public endpoint serves. The
 * moderation test additionally drives the real admin endpoint to prove that
 * path recomputes by itself.
 */

function getCookie(res: { headers: Record<string, unknown> }): string {
  const cookies = res.headers['set-cookie'];
  return Array.isArray(cookies) ? cookies.join('; ') : (cookies ?? '');
}

const uniq = (label: string) => `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Category ratings in column order: WLB, culture, management, compensation, opportunities. */
type Categories = [number, number, number, number, number];

let adminCookie: string;
const createdCompanyIds: string[] = [];
const createdUserEmails: string[] = [];

async function insertIndustry(): Promise<string> {
  const existing = await pool.query<{ id: string }>('SELECT id FROM industries LIMIT 1');
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await pool.query<{ id: string }>(
    `INSERT INTO industries (name, slug) VALUES ($1, $2) RETURNING id`,
    ['Stats Test Industry', uniq('stats-test-industry')],
  );
  return created.rows[0]!.id;
}

async function insertCompany(label: string): Promise<{ id: string; slug: string }> {
  const industryId = await insertIndustry();
  const slug = uniq(`company-stats-${label}`);

  const created = await pool.query<{ id: string }>(
    `INSERT INTO companies (name, slug, industry_id, country)
     VALUES ($1, $2, $3, 'Testland')
     RETURNING id`,
    [`Company Stats ${label}`, slug, industryId],
  );
  const id = created.rows[0]!.id;
  createdCompanyIds.push(id);
  return { id, slug };
}

async function insertUser(): Promise<string> {
  const email = `${uniq('company-stats-test')}@test.local`;
  createdUserEmails.push(email);

  const created = await pool.query<{ id: string }>(
    `INSERT INTO users (email, display_name, role, email_verified)
     VALUES ($1, 'Stats Test', 'user', true)
     RETURNING id`,
    [email],
  );
  return created.rows[0]!.id;
}

async function insertReview(input: {
  companyId: string;
  title: string;
  status: 'published' | 'pending' | 'rejected';
  /** Stored star value — what the form sends after rounding the categories. */
  overallRating?: number | null;
  /** `null` mimics legacy/seed rows that carry no category ratings. */
  categories?: Categories | null;
}): Promise<string> {
  const userId = await insertUser();
  const publicId = uniq('statsreview');
  const categories = input.categories ?? null;

  await pool.query(
    `INSERT INTO reviews (
       public_id, user_id, company_id, title, overall_rating, status,
       work_life_balance, culture, management, compensation, opportunities, content_fingerprint
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      publicId,
      userId,
      input.companyId,
      input.title,
      input.overallRating ?? null,
      input.status,
      categories?.[0] ?? null,
      categories?.[1] ?? null,
      categories?.[2] ?? null,
      categories?.[3] ?? null,
      categories?.[4] ?? null,
      uniq('fingerprint'),
    ],
  );

  return publicId;
}

async function companyStats(slug: string) {
  const res = await apiCall('get', `/api/v1/companies/${slug}`);
  expect(res.status).toBe(200);
  return res.body.data as {
    reviewCount: number;
    averageRating: string | null;
    recommendationRate: number;
  };
}

/** The exact recompute pair every review service performs inside its transaction. */
async function recomputeCompanyStats(companyId: string): Promise<void> {
  const stats = await reviewsRepository.getCompanyReviewStats(companyId);
  await companiesRepository.updateStats(companyId, stats);
}

beforeAll(async () => {
  // Login binds to an existing anonymous identity (same pattern as the other
  // suites): the session cookie replaces the device's guest cookie.
  const identity = await apiCall('get', '/api/v1/anonymous/me');
  const login = await apiCall('post', '/api/v1/user/login', {
    body: { email: 'admin@seethrough.com', password: 'admin123' },
    cookie: getCookie(identity),
  });
  expect(login.status).toBe(200);
  adminCookie = getCookie(login);
  expect(adminCookie).toContain('=');
});

afterAll(async () => {
  // Keep the shared dev database as we found it.
  if (createdCompanyIds.length > 0) {
    await pool.query('DELETE FROM reviews WHERE company_id = ANY($1::uuid[])', [createdCompanyIds]);
    await pool.query('DELETE FROM companies WHERE id = ANY($1::uuid[])', [createdCompanyIds]);
  }
  if (createdUserEmails.length > 0) {
    await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [createdUserEmails]);
  }
});

describe('Company stats — which reviews count', () => {
  it('a pending or rejected review never moves the count, average or recommended %', async () => {
    const { id, slug } = await insertCompany('status');

    await insertReview({
      companyId: id,
      title: 'Published five star',
      status: 'published',
      overallRating: 5,
      categories: [5, 5, 5, 5, 5],
    });
    await insertReview({
      companyId: id,
      title: 'Pending five star',
      status: 'pending',
      overallRating: 5,
      categories: [5, 5, 5, 5, 5],
    });
    await insertReview({
      companyId: id,
      title: 'Rejected five star',
      status: 'rejected',
      overallRating: 5,
      categories: [5, 5, 5, 5, 5],
    });

    await recomputeCompanyStats(id);

    const stats = await companyStats(slug);
    expect(stats.reviewCount).toBe(1);
    expect(stats.averageRating).toBe('5.0');
    expect(stats.recommendationRate).toBe(100);
  });

  it('rejecting a published review removes it from the stats via the admin endpoint', async () => {
    const { id, slug } = await insertCompany('reject');

    await insertReview({
      companyId: id,
      title: 'Published five star',
      status: 'published',
      overallRating: 5,
      categories: [5, 5, 5, 5, 5],
    });
    const weakPublicId = await insertReview({
      companyId: id,
      title: 'Published three star',
      status: 'published',
      overallRating: 3,
      categories: [3, 3, 3, 3, 3],
    });

    await recomputeCompanyStats(id);

    const before = await companyStats(slug);
    expect(before.reviewCount).toBe(2);
    expect(before.averageRating).toBe('4.0');
    expect(before.recommendationRate).toBe(50);

    const reject = await apiCall('patch', `/api/v1/reviews/admin/${weakPublicId}/status`, {
      cookie: adminCookie,
      body: { status: 'rejected' },
    });
    expect(reject.status).toBe(200);

    const after = await companyStats(slug);
    expect(after.reviewCount).toBe(1);
    expect(after.averageRating).toBe('5.0');
    expect(after.recommendationRate).toBe(100);

    // Re-approving restores it — rejection is not a one-way door.
    const approve = await apiCall('patch', `/api/v1/reviews/admin/${weakPublicId}/status`, {
      cookie: adminCookie,
      body: { status: 'published' },
    });
    expect(approve.status).toBe(200);
    expect((await companyStats(slug)).reviewCount).toBe(2);
  });

  it('"Recommended %" uses the unrounded category average, not the stored star value', async () => {
    const { id, slug } = await insertCompany('recommended');

    // The review form rounds the category average into `overall_rating`, so
    // these three reviews are all stored as 4 stars — but only one of them
    // actually averages 4.0 across the categories it was graded on.
    await insertReview({
      companyId: id,
      title: 'Genuinely recommended',
      status: 'published',
      overallRating: 4,
      categories: [4, 4, 4, 4, 4], // 4.0 -> recommended
    });
    await insertReview({
      companyId: id,
      title: 'Lukewarm, rounds up to four',
      status: 'published',
      overallRating: 4,
      categories: [4, 4, 4, 3, 3], // 3.6 -> not recommended
    });
    await insertReview({
      companyId: id,
      title: 'Mixed, rounds up to four',
      status: 'published',
      overallRating: 4,
      categories: [5, 5, 3, 4, 4], // 4.2 -> recommended
    });
    // Legacy/seed row: no category ratings, so the stored star value decides.
    await insertReview({
      companyId: id,
      title: 'Legacy row without categories',
      status: 'published',
      overallRating: 3,
      categories: null, // 3 -> not recommended
    });
    // No ratings at all: counts as a review, but cannot enter the percentage.
    await insertReview({
      companyId: id,
      title: 'Unrated review',
      status: 'published',
      overallRating: null,
      categories: null,
    });

    await recomputeCompanyStats(id);

    const stats = await companyStats(slug);
    expect(stats.reviewCount).toBe(5);
    // Published averages: 4, 4, 4, 3 and one unrated (ignored by avg).
    expect(stats.averageRating).toBe('3.8');
    // Recommended 2 of the 4 rated reviews — deciding off the stored star
    // values would have said 4 of 4 (all four are stored as 4 or 5 stars).
    expect(stats.recommendationRate).toBe(50);
  });

  it('a company with no published reviews reports empty stats, not zeros from a rejected review', async () => {
    const { id, slug } = await insertCompany('empty');

    await insertReview({
      companyId: id,
      title: 'Rejected only review',
      status: 'rejected',
      overallRating: 5,
      categories: [5, 5, 5, 5, 5],
    });

    await recomputeCompanyStats(id);

    const stats = await companyStats(slug);
    expect(stats.reviewCount).toBe(0);
    expect(stats.averageRating).toBeNull();
    expect(stats.recommendationRate).toBe(0);
  });
});
