import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import { pool } from '../database/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { apiCall } from './helpers.js';
import { userAuthRepository } from '../modules/user-auth/repository/userAuth.repository.js';
import { reviewModerationAlertService } from '../modules/reviews/service/review-moderation-alert.service.js';
import {
  sendPendingReviewAlert,
  buildPendingReviewEmail,
  type PendingReviewEmailReview,
} from '../services/email.service.js';

/**
 * Review moderation alerts — anonymous reviews are stored `pending`, and the
 * moderators must hear about it immediately with a link to approve or reject.
 *
 * IMPORTANT: the test `.env` can hold a live provider key, so nothing here may
 * reach the mail provider. The suite therefore never flips the service out of
 * its test-mode rail, and the only call into the sender uses a cleared key so
 * the provider client is never even constructed.
 */

const uniq = (label: string) => `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createdCompanyIds: string[] = [];
const createdUserEmails: string[] = [];

async function insertUser(options: {
  role?: 'user' | 'admin';
  emailVerified?: boolean;
  isBlocked?: boolean;
  isGuest?: boolean;
}): Promise<string> {
  const email = `${uniq('alert-test')}@test.local`;
  createdUserEmails.push(email);

  await pool.query(
    `INSERT INTO users (email, display_name, role, email_verified, is_blocked, is_guest)
     VALUES ($1, 'Alert Test', $2, $3, $4, $5)`,
    [
      email,
      options.role ?? 'user',
      options.emailVerified ?? true,
      options.isBlocked ?? false,
      options.isGuest ?? false,
    ],
  );

  return email;
}

async function insertCompany(label: string): Promise<{ id: string; slug: string }> {
  const industry = await pool.query<{ id: string }>('SELECT id FROM industries LIMIT 1');
  const slug = uniq(`review-alert-${label}`);

  const created = await pool.query<{ id: string }>(
    `INSERT INTO companies (name, slug, industry_id, country)
     VALUES ($1, $2, $3, 'Testland')
     RETURNING id`,
    [`Review Alert ${label}`, slug, industry.rows[0]!.id],
  );

  const id = created.rows[0]!.id;
  createdCompanyIds.push(id);
  return { id, slug };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  // Leave the shared dev database as we found it: our reviews, companies,
  // test users, and the anonymous identity minted for the guest review.
  if (createdCompanyIds.length > 0) {
    const authors = await pool.query<{ user_id: string }>(
      'SELECT DISTINCT user_id FROM reviews WHERE company_id = ANY($1::uuid[])',
      [createdCompanyIds],
    );
    await pool.query('DELETE FROM reviews WHERE company_id = ANY($1::uuid[])', [createdCompanyIds]);
    await pool.query('DELETE FROM companies WHERE id = ANY($1::uuid[])', [createdCompanyIds]);

    const guestIds = authors.rows.map((row) => row.user_id);
    if (guestIds.length > 0) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[]) AND is_guest = true', [guestIds]);
    }
  }
  if (createdUserEmails.length > 0) {
    await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [createdUserEmails]);
  }
});

describe('Moderation alert recipients', () => {
  it('targets verified, unblocked admin accounts only', async () => {
    const verifiedAdmin = await insertUser({ role: 'admin', emailVerified: true });
    const unverifiedAdmin = await insertUser({ role: 'admin', emailVerified: false });
    const blockedAdmin = await insertUser({ role: 'admin', emailVerified: true, isBlocked: true });
    const guestAdminLike = await insertUser({ role: 'admin', emailVerified: true, isGuest: true });
    const verifiedUser = await insertUser({ role: 'user', emailVerified: true });

    const recipients = await userAuthRepository.findModerationAlertRecipients();

    expect(recipients).toContain(verifiedAdmin);
    // The seeded admin from the test setup is a verified admin too.
    expect(recipients).toContain('admin@seethrough.com');
    expect(recipients).not.toContain(unverifiedAdmin);
    expect(recipients).not.toContain(blockedAdmin);
    expect(recipients).not.toContain(guestAdminLike);
    expect(recipients).not.toContain(verifiedUser);
  });
});

describe('Moderation alert email content', () => {
  const review: PendingReviewEmailReview = {
    publicId: 'alertpublicid123',
    companyName: 'Acme <script>alert(1)</script>',
    companySlug: 'acme',
    title: 'Long hours but fair pay',
    overallRating: 4,
    pros: 'Good team',
    cons: 'Commute',
  };

  it('links straight to the admin review screen and escapes review content', () => {
    const { subject, html } = buildPendingReviewEmail(review, 'anonymous');

    expect(subject).toContain('moderation');
    expect(html).toContain(`${env.FRONTEND_URL}/admin/reviews/alertpublicid123`);
    expect(html).toContain('Approve or reject');
    // Content is escaped, never injected raw into the email body.
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    // Reading the mail alone must be enough to moderate.
    expect(html).toContain('Long hours but fair pay');
    expect(html).toContain('4/5');
  });

  it('explains why the review was held back', () => {
    const anonymous = buildPendingReviewEmail(review, 'anonymous').html;
    const duplicate = buildPendingReviewEmail(review, 'possible-duplicate').html;

    expect(anonymous).toContain('Posted anonymously');
    expect(duplicate).toContain('closely matches an existing review');
    expect(anonymous).not.toBe(duplicate);
  });

  it('truncates an over-long excerpt instead of sending the whole essay', () => {
    const { html } = buildPendingReviewEmail(
      { ...review, pros: 'p'.repeat(4000), cons: null },
      'anonymous',
    );

    expect(html).toContain('…');
    expect(html.length).toBeLessThan(6000);
    expect(html).toContain('—'); // the empty cons field
  });
});

describe('Moderation alert trigger', () => {
  it('emails the admin when an anonymous review is held for moderation, and stays quiet for a signed-in one', async () => {
    const { slug } = await insertCompany('trigger');
    // Replaced, not wrapped: this test asserts the alert is *requested*, and
    // the rail test above covers what the service does about it.
    const notify = vi
      .spyOn(reviewModerationAlertService, 'notifyPendingReview')
      .mockResolvedValue(undefined);

    // Anonymous poster: no session at all, own rate-limit bucket.
    const guestPost = await apiCall('post', '/api/v1/reviews', {
      headers: { 'x-forwarded-for': '203.0.113.201' },
      body: {
        companySlug: slug,
        title: uniq('Anonymous review waiting for approval'),
        pros: uniq('Pros written anonymously'),
        cons: uniq('Cons written anonymously'),
        overallRating: 4,
        workLifeBalance: 4,
        culture: 4,
        management: 4,
        compensation: 4,
        opportunities: 4,
      },
    });
    expect(guestPost.status).toBe(201);
    expect(guestPost.body.data.status).toBe('pending');

    expect(notify).toHaveBeenCalledTimes(1);
    const [alertedReview, reason] = notify.mock.calls[0]!;
    expect(alertedReview.publicId).toBe(guestPost.body.data.publicId);
    expect(reason).toBe('anonymous');

    // A signed-in account publishes immediately, so nothing needs moderating.
    const identity = await apiCall('get', '/api/v1/anonymous/me');
    const cookies = identity.headers['set-cookie'];
    const login = await apiCall('post', '/api/v1/user/login', {
      cookie: Array.isArray(cookies) ? cookies.join('; ') : String(cookies ?? ''),
      headers: { 'x-forwarded-for': '203.0.113.202' },
      body: { email: 'admin@seethrough.com', password: 'admin123' },
    });
    expect(login.status).toBe(200);
    const adminCookies = login.headers['set-cookie'];
    const adminCookie = Array.isArray(adminCookies)
      ? adminCookies.join('; ')
      : String(adminCookies ?? '');

    const accountPost = await apiCall('post', '/api/v1/reviews', {
      cookie: adminCookie,
      headers: { 'x-forwarded-for': '203.0.113.203' },
      body: {
        companySlug: slug,
        title: uniq('Signed in review published immediately'),
        pros: uniq('Pros from an account'),
        cons: uniq('Cons from an account'),
        overallRating: 5,
        workLifeBalance: 5,
        culture: 5,
        management: 5,
        compensation: 5,
        opportunities: 5,
      },
    });
    expect(accountPost.status).toBe(201);
    expect(accountPost.body.data.status).toBe('published');

    // Still just the one alert, for the anonymous review.
    expect(notify).toHaveBeenCalledTimes(1);
    notify.mockRestore();
  });
});

describe('Moderation alert delivery', () => {
  const review: PendingReviewEmailReview = {
    publicId: 'delivery-public-id',
    companyName: 'Delivery Co',
    companySlug: 'delivery-co',
    title: 'Delivery test review',
    overallRating: 3,
    pros: null,
    cons: null,
  };

  it('resolves recipients from ADMIN_ALERT_EMAILS when set, otherwise from the admins', async () => {
    const previous = env.ADMIN_ALERT_EMAILS;
    try {
      env.ADMIN_ALERT_EMAILS = ' moderation@example.com ,, second@example.com ';
      expect(await reviewModerationAlertService.resolveRecipients()).toEqual([
        'moderation@example.com',
        'second@example.com',
      ]);

      env.ADMIN_ALERT_EMAILS = undefined;
      expect(await reviewModerationAlertService.resolveRecipients()).toContain(
        'admin@seethrough.com',
      );
    } finally {
      env.ADMIN_ALERT_EMAILS = previous;
    }
  });

  it('stops before resolving recipients or sending while running under test', async () => {
    const resolve = vi.spyOn(reviewModerationAlertService, 'resolveRecipients');
    const log = vi.spyOn(logger, 'info');

    await reviewModerationAlertService.notifyPendingReview(review, 'anonymous');

    // The rail fires first, so no recipient lookup happens and the mail
    // transport is never reached — a test run cannot email anybody.
    expect(resolve).not.toHaveBeenCalled();
    const skipped = log.mock.calls.find((call) =>
      String(call[call.length - 1]).includes('Skipping moderation alert email'),
    );
    expect(skipped).toBeDefined();

    resolve.mockRestore();
    log.mockRestore();
  });

  it('reports a missing mail configuration instead of calling the provider', async () => {
    const previousKey = env.RESEND_API_KEY;
    try {
      env.RESEND_API_KEY = '';
      const result = await sendPendingReviewAlert(['someone@test.local'], review, 'anonymous');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service is not configured');
    } finally {
      env.RESEND_API_KEY = previousKey;
    }

    // No recipients is a no-op too, never a provider call with an empty list.
    const noRecipients = await sendPendingReviewAlert([], review, 'anonymous');
    expect(noRecipients.success).toBe(false);
    expect(noRecipients.error).toBe('No recipients');
  });
});
