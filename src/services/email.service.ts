import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let resendClient: Resend | null = null;

function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) {
    logger.warn('RESEND_API_KEY not set — emails will not be sent');
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

const FRONTEND_URL = env.FRONTEND_URL || 'http://localhost:5173';

export interface EmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send an email verification link to the user.
 */
export async function sendVerificationEmail(
  to: string,
  token: string,
  displayName: string,
): Promise<EmailResult> {
  logger.info(
    {
      resendConfigured: !!env.RESEND_API_KEY,
      emailFrom: env.EMAIL_FROM,
      frontendUrl: FRONTEND_URL,
    },
    'Verification email configuration',
  );
  const client = getClient();
  if (!client) {
    logger.error('RESEND_API_KEY is not configured');
    throw new Error('Email service is not configured');
  }
  // if (!client) {
  //   console.warn(
  //     '⚠️  RESEND_API_KEY not set — skipping verification email. Token:',
  //     token,
  //   );
  //   return { success: true }; // Don't block registration in dev
  // }

  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  try {
    logger.info(
      {
        to,
        from: env.EMAIL_FROM,
        frontendUrl: FRONTEND_URL,
      },
      'Attempting to send verification email',
    );
    const result = await client.emails.send({
      from: env.EMAIL_FROM || 'SeeThrough <noreply@seethrough.app>',
      to,
      subject: 'Verify your email — SeeThrough',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
          <h1 style="font-size: 24px; margin-bottom: 16px;">Welcome to SeeThrough, ${escapeHtml(displayName)}!</h1>
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
            Thanks for signing up. Please verify your email address to start posting reviews.
          </p>
          <a href="${verificationUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Verify Email Address
          </a>
          <p style="font-size: 14px; color: #666; margin-top: 24px;">
            This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
          </p>
          <p style="font-size: 14px; color: #666;">
            Or copy and paste this URL into your browser:<br>
            <a href="${verificationUrl}" style="color: #666; word-break: break-all;">${verificationUrl}</a>
          </p>
        </body>
        </html>
      `,
    });
    if (result.error) {
      logger.error(
        {
          resendError: result.error,
          to,
        },
        'Resend rejected verification email',
      );

      throw new Error(result.error.message);
    }

    logger.info({ emailId: result.data?.id, to }, 'Verification email sent');

    return { success: true };
  } catch (err) {
    logger.error(
      {
        err,
        to,
      },
      'Failed to send verification email',
    );

    throw err;
  }
  // logger.error({ err, to }, 'Failed to send verification email');
  // return {
  //   success: false,
  //   error: err instanceof Error ? err.message : 'Unknown error',
  // };
}

/**
 * Send a password reset email to the user.
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string,
  displayName: string,
): Promise<EmailResult> {
  const client = getClient();
  if (!client) {
    console.warn('⚠️  RESEND_API_KEY not set — skipping password reset email. Token:', token);
    return { success: true };
  }

  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  try {
    const result = await client.emails.send({
      from: env.EMAIL_FROM || 'SeeThrough <noreply@seethrough.app>',
      to,
      subject: 'Reset your password — SeeThrough',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
          <h1 style="font-size: 24px; margin-bottom: 16px;">Password Reset</h1>
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
            Hi ${escapeHtml(displayName)}, we received a request to reset your password.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Reset Password
          </a>
          <p style="font-size: 14px; color: #666; margin-top: 24px;">
            This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>
          <p style="font-size: 14px; color: #666;">
            Or copy and paste this URL into your browser:<br>
            <a href="${resetUrl}" style="color: #666; word-break: break-all;">${resetUrl}</a>
          </p>
        </body>
        </html>
      `,
    });

    logger.info({ emailId: result.data?.id, to }, 'Password reset email sent');
    if (result.error) {
      logger.error({ resendError: result.error, to }, 'Resend rejected password reset email');
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (err) {
    logger.error({ err, to }, 'Failed to send password reset email');
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export interface PendingReviewEmailReview {
  publicId: string;
  companyName: string | null;
  companySlug: string | null;
  title: string;
  overallRating: number | null;
  pros: string | null;
  cons: string | null;
}

/** Why a review was held back instead of publishing straight away. */
export type PendingReviewReason = 'anonymous' | 'possible-duplicate';

const EXCERPT_LENGTH = 400;

function excerpt(value: string | null): string {
  if (!value) return '—';
  const trimmed = value.trim();
  return trimmed.length > EXCERPT_LENGTH
    ? `${trimmed.slice(0, EXCERPT_LENGTH)}…`
    : trimmed;
}

/**
 * Subject + HTML for the "a review is waiting for moderation" alert.
 *
 * Split out from the send so the content (deep link, escaping, reason) can be
 * asserted without touching the mail provider.
 */
export function buildPendingReviewEmail(
  review: PendingReviewEmailReview,
  reason: PendingReviewReason,
): { subject: string; html: string } {
  const company = review.companyName || review.companySlug || 'Unknown company';
  const reviewUrl = `${FRONTEND_URL}/admin/reviews/${review.publicId}`;
  const reasonLabel =
    reason === 'anonymous'
      ? 'Posted anonymously — anyone can post without an account, so it is held for review.'
      : 'Held automatically because the text closely matches an existing review.';
  const rating = review.overallRating !== null ? `${review.overallRating}/5` : 'no rating';

  return {
    subject: `Review waiting for moderation — ${company}`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
          <h1 style="font-size: 20px; margin-bottom: 8px;">A review needs your decision</h1>
          <p style="font-size: 14px; line-height: 1.5; color: #555; margin-bottom: 20px;">${escapeHtml(reasonLabel)}</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #666; width: 110px;">Company</td><td style="padding: 6px 0;"><strong>${escapeHtml(company)}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Title</td><td style="padding: 6px 0;">${escapeHtml(review.title)}</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Rating</td><td style="padding: 6px 0;">${escapeHtml(rating)}</td></tr>
            <tr><td style="padding: 6px 0; color: #666; vertical-align: top;">Pros</td><td style="padding: 6px 0;">${escapeHtml(excerpt(review.pros))}</td></tr>
            <tr><td style="padding: 6px 0; color: #666; vertical-align: top;">Cons</td><td style="padding: 6px 0;">${escapeHtml(excerpt(review.cons))}</td></tr>
          </table>
          <a href="${reviewUrl}" style="display: inline-block; margin-top: 24px; background-color: #1a1a1a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Approve or reject
          </a>
          <p style="font-size: 13px; color: #666; margin-top: 20px;">
            Approving publishes the review and adds it to the company's rating. Rejecting keeps it hidden and out of the company's statistics.
          </p>
          <p style="font-size: 13px; color: #666;">
            Or copy and paste this URL into your browser:<br>
            <a href="${reviewUrl}" style="color: #666; word-break: break-all;">${reviewUrl}</a>
          </p>
        </body>
        </html>
      `,
  };
}

/**
 * Email the moderators about a review that was held for approval.
 *
 * Deliberately never throws: a mail failure must not fail the review the
 * reviewer just posted. Problems are logged and reported in the result.
 */
export async function sendPendingReviewAlert(
  recipients: string[],
  review: PendingReviewEmailReview,
  reason: PendingReviewReason,
): Promise<EmailResult> {
  if (recipients.length === 0) {
    return { success: false, error: 'No recipients' };
  }

  const client = getClient();
  if (!client) {
    logger.warn(
      { publicId: review.publicId, recipients: recipients.length },
      'RESEND_API_KEY not set — moderation alert email skipped',
    );
    return { success: false, error: 'Email service is not configured' };
  }

  const { subject, html } = buildPendingReviewEmail(review, reason);

  try {
    const result = await client.emails.send({
      from: env.EMAIL_FROM || 'SeeThrough <noreply@seethrough.app>',
      to: recipients,
      subject,
      html,
    });

    if (result.error) {
      logger.error(
        { resendError: result.error, publicId: review.publicId },
        'Resend rejected moderation alert email',
      );
      return { success: false, error: result.error.message };
    }

    logger.info(
      { emailId: result.data?.id, publicId: review.publicId, recipients: recipients.length },
      'Moderation alert email sent',
    );
    return { success: true };
  } catch (err) {
    logger.error(
      { err, publicId: review.publicId },
      'Failed to send moderation alert email',
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Escape HTML to prevent XSS in email templates.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
