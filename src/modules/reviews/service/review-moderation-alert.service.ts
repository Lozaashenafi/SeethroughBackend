import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import {
  sendPendingReviewAlert,
  buildPendingReviewEmail,
  type PendingReviewEmailReview,
  type PendingReviewReason,
} from '../../../services/email.service.js';
import { userAuthRepository } from '../../user-auth/repository/userAuth.repository.js';

/**
 * Emails the moderators as soon as a review is held for approval.
 *
 * Anonymous reviews (and the ones flagged as near-duplicates) are stored as
 * `pending` and stay out of the company's statistics until an admin decides.
 * Without this, that decision waits on somebody opening the admin review queue;
 * the alert lands in the admin's inbox with a direct approve/reject link.
 *
 * Never throws: a mail problem must not fail the review the reviewer just
 * posted, so every failure is logged and swallowed.
 */
class ReviewModerationAlertService {
  /**
   * Recipients are the addresses in `ADMIN_ALERT_EMAILS` when configured (a
   * team inbox, say), otherwise every verified, unblocked admin account.
   */
  async resolveRecipients(): Promise<string[]> {
    const configured = (env.ADMIN_ALERT_EMAILS ?? '')
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean);

    if (configured.length > 0) return configured;

    return userAuthRepository.findModerationAlertRecipients();
  }

  async notifyPendingReview(
    review: PendingReviewEmailReview,
    reason: PendingReviewReason,
  ): Promise<void> {
    try {
      // Safety rail: the test suite runs against a database and an `.env` that
      // may hold a live provider key, and tests create pending reviews on
      // purpose. Never send real mail from a test run.
      if (env.NODE_ENV === 'test') {
        const { subject } = buildPendingReviewEmail(review, reason);
        logger.info(
          { publicId: review.publicId, reason, subject },
          'Skipping moderation alert email in test run',
        );
        return;
      }

      const recipients = await this.resolveRecipients();
      if (recipients.length === 0) {
        logger.warn(
          { publicId: review.publicId, reason },
          'No moderation alert recipients — set ADMIN_ALERT_EMAILS or give an admin a verified email',
        );
        return;
      }

      const result = await sendPendingReviewAlert(recipients, review, reason);
      if (!result.success) {
        logger.error(
          { publicId: review.publicId, reason, error: result.error },
          'Moderation alert email was not delivered',
        );
      }
    } catch (err) {
      logger.error(
        { err, publicId: review.publicId, reason },
        'Failed to notify moderators about a pending review',
      );
    }
  }
}

export const reviewModerationAlertService = new ReviewModerationAlertService();
