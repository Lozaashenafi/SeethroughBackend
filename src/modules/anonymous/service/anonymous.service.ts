import { nanoid } from 'nanoid';
import { randomInt } from 'node:crypto';
import { db } from '../../../database/db.js';
import { anonymousRepository } from '../repository/anonymous.repository.js';
import { reviewsRepository } from '../../reviews/repository/reviews.repository.js';
import { companiesRepository } from '../../companies/repository/companies.repository.js';
import { commentsRepository } from '../../comments/repository/comments.repository.js';
import { votesRepository } from '../../votes/repository/votes.repository.js';
import { reportsRepository } from '../../reports/repository/reports.repository.js';
import { toReviewResponse, type ReviewResponse } from '../../reviews/types/reviews.types.js';
import { ANONYMOUS_ID_LENGTH } from '../../../shared/constants/index.js';
import { generateNickname } from '../../../shared/utils/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import type { AnonymousIdentity } from '../../../shared/types/index.js';
import type {
  AnonymousActivityResponse,
  ActivityPagination,
  CreateAnonymousResult,
} from '../types/anonymous.types.js';
import {
  toAnonymousResponse,
  toCommentActivityItem,
  toVoteActivityItem,
  toReportActivityItem,
} from '../types/anonymous.types.js';

// How many random adjective+animal combinations to try before falling back to
// a numeric suffix. With ~1,200 combos, a collision after this many tries is
// essentially impossible.
const NICKNAME_UNIQUE_ATTEMPTS = 20;
// Maximum attempts for the numeric-suffix fallback to prevent an infinite loop
// if the nickname space is somehow exhausted.
const NICKNAME_FALLBACK_MAX_ATTEMPTS = 100;

const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;
const LAST_SEEN_CACHE_MAX_ENTRIES = 10_000;
const LAST_SEEN_CACHE_TTL_MS = 60 * 60 * 1000;
const lastSeenCache = new Map<string, number>();

function pruneLastSeenCache(now: number): void {
  if (lastSeenCache.size < LAST_SEEN_CACHE_MAX_ENTRIES) return;

  // Drop expired entries first.
  for (const [id, lastUpdate] of lastSeenCache) {
    if (now - lastUpdate > LAST_SEEN_CACHE_TTL_MS) lastSeenCache.delete(id);
  }

  // If still oversized, drop the oldest half to bound memory usage.
  if (lastSeenCache.size >= LAST_SEEN_CACHE_MAX_ENTRIES) {
    const sorted = [...lastSeenCache.entries()].sort((a, b) => a[1] - b[1]);
    const toRemove = sorted.slice(0, Math.floor(lastSeenCache.size / 2));
    for (const [id] of toRemove) lastSeenCache.delete(id);
  }
}

class AnonymousService {
  /**
   * Generates a nickname that is not already in use by another identity.
   * Nicknames are unique platform-wide; a fresh random combo is drawn until a
   * free one is found, with a numeric-suffix fallback.
   */
  private async generateUniqueNickname(): Promise<string> {
    for (let attempt = 0; attempt < NICKNAME_UNIQUE_ATTEMPTS; attempt += 1) {
      const candidate = generateNickname();
      const existing = await anonymousRepository.findByNickname(candidate);
      if (!existing) return candidate;
    }

    let candidate = '';
    for (let attempt = 0; attempt < NICKNAME_FALLBACK_MAX_ATTEMPTS; attempt += 1) {
      candidate = `${generateNickname()} ${randomInt(10, 999)}`;
      const existing = await anonymousRepository.findByNickname(candidate);
      if (!existing) return candidate;
    }
    throw new AppError('Unable to generate a unique nickname. Please try again.', 500);
  }

  async create(): Promise<CreateAnonymousResult> {
    const publicId = nanoid(ANONYMOUS_ID_LENGTH);
    const nickname = await this.generateUniqueNickname();
    try {
      return await anonymousRepository.create({ publicId, nickname });
    } catch (error) {
      // Race: another minted identity claimed the same nickname between the
      // availability check and the insert. Retry once with a fresh nickname.
      if ((error as { code?: string }).code === '23505') {
        return anonymousRepository.create({
          publicId,
          nickname: await this.generateUniqueNickname(),
        });
      }
      throw error;
    }
  }

  async findByPublicId(publicId: string): Promise<AnonymousIdentity | null> {
    if (!publicId) return null;
    return anonymousRepository.findByPublicId(publicId);
  }

  /**
   * Re-issue a session token for an existing identity. Called when the browser
   * presents a valid publicId but a stale/mismatched session cookie — instead
   * of creating a new identity (which wastes DB rows), we refresh the session.
   */
  async reissueSessionToken(id: string): Promise<string> {
    return anonymousRepository.reissueSessionToken(id);
  }

  async findById(id: string): Promise<AnonymousIdentity | null> {
    return anonymousRepository.findById(id);
  }

  async updateLastSeen(id: string): Promise<void> {
    const now = Date.now();
    pruneLastSeenCache(now);
    const lastUpdate = lastSeenCache.get(id);
    if (lastUpdate && now - lastUpdate < LAST_SEEN_THROTTLE_MS) return;
    lastSeenCache.set(id, now);
    await anonymousRepository.updateLastSeen(id);
  }

  async getCurrentIdentity(publicId: string): Promise<AnonymousIdentity> {
    const identity = await this.findByPublicId(publicId);
    if (!identity) {
      throw new AppError('Anonymous identity not found', 404);
    }
    return identity;
  }

  async list(params: { page: number; limit: number; status?: string; search?: string }) {
    return anonymousRepository.findAll(params);
  }

  async block(publicId: string): Promise<AnonymousIdentity> {
    const identity = await anonymousRepository.findByPublicId(publicId);
    if (!identity) {
      throw new AppError('Identity not found', 404);
    }
    if (identity.isBlocked) {
      throw new AppError('Identity is already blocked', 409);
    }
    return anonymousRepository.setBlocked(identity.id, true);
  }

  async unblock(publicId: string): Promise<AnonymousIdentity> {
    const identity = await anonymousRepository.findByPublicId(publicId);
    if (!identity) {
      throw new AppError('Identity not found', 404);
    }
    if (!identity.isBlocked) {
      throw new AppError('Identity is not blocked', 409);
    }
    return anonymousRepository.setBlocked(identity.id, false);
  }

  /**
   * Set or regenerate the public nickname for an identity. Allowed at most once
   * per identity — after that the nickname is permanent so a reviewer can't keep
   * cycling pseudonyms to dodge being recognized by other users.
   *
   * - nickname provided  → used verbatim (character/length rules enforced by
   *   the route validation layer)
   * - nickname omitted   → the server picks a fresh auto-generated one
   */
  async changeNickname(publicId: string, nickname?: string): Promise<AnonymousIdentity> {
    const identity = await anonymousRepository.findByPublicId(publicId);
    if (!identity) {
      throw new AppError('Identity not found', 404);
    }
    if (identity.isBlocked) {
      throw new AppError('Identity is blocked', 403);
    }
    if (identity.nicknameRegeneratedAt) {
      throw new AppError('Nickname can only be changed once', 409);
    }

    const requested = nickname?.trim();
    // Saving the exact current name is a no-op and must NOT consume the
    // one-time change budget.
    if (requested && requested === identity.nickname) {
      return identity;
    }

    if (requested) {
      // Custom nicknames are unique platform-wide — reject names already in
      // use by another identity with a friendly error.
      const taken = await anonymousRepository.findByNickname(requested);
      if (taken && taken.id !== identity.id) {
        throw new AppError('This nickname is already taken. Please choose another.', 409);
      }
      return anonymousRepository.updateNickname(identity.id, requested);
    }

    // No nickname provided — the server picks a fresh, unused one.
    return anonymousRepository.updateNickname(
      identity.id,
      await this.generateUniqueNickname(),
    );
  }

  /** Backfill a nickname for identities created before nicknames existed. */
  async ensureNickname(identity: AnonymousIdentity): Promise<AnonymousIdentity> {
    if (identity.nickname) return identity;
    // Backfill must NOT consume the identity's one-time regeneration right
    // (updateNickname sets nicknameRegeneratedAt), so use the dedicated method.
    return anonymousRepository.backfillNickname(
      identity.id,
      await this.generateUniqueNickname(),
    );
  }

  /**
   * Permanently delete an identity and ALL of its content (reviews, comments,
   * votes, reports) in a single transaction. The identity's cookies become
   * orphaned server-side: the next visit from that browser mints a brand-new
   * identity, so the same person returns as a fresh user. Company stats are
   * recomputed for every affected company so the denormalized counters never
   * drift from the actual review set.
   */
  async deleteIdentity(publicId: string): Promise<void> {
    const identity = await anonymousRepository.findByPublicId(publicId);
    if (!identity) {
      throw new AppError('Identity not found', 404);
    }

    await db.transaction(async (tx) => {
      const affectedCompanyIds = await anonymousRepository.deleteContentWithClient(tx, identity.id);
      await anonymousRepository.deleteWithClient(tx, identity.id);

      for (const companyId of affectedCompanyIds) {
        const stats = await reviewsRepository.getCompanyReviewStatsWithClient(tx, companyId);
        await companiesRepository.updateStatsWithClient(tx, companyId, stats);
      }
    });
  }

  async isTemporarilyBlocked(identity: AnonymousIdentity): Promise<boolean> {
    return Boolean(identity.tempBlockedUntil && identity.tempBlockedUntil.getTime() > Date.now());
  }

  async tempBlock(publicId: string, durationMs: number): Promise<AnonymousIdentity> {
    const identity = await anonymousRepository.findByPublicId(publicId);
    if (!identity) {
      throw new AppError('Identity not found', 404);
    }
    return anonymousRepository.setTempBlocked(identity.id, new Date(Date.now() + durationMs));
  }

  async clearTempBlock(publicId: string): Promise<AnonymousIdentity> {
    const identity = await anonymousRepository.findByPublicId(publicId);
    if (!identity) {
      throw new AppError('Identity not found', 404);
    }
    return anonymousRepository.clearTempBlock(identity.id);
  }

  /**
   * The current identity's own reviews (any moderation status), newest first.
   * Unlike the public review feed this includes pending/rejected content so
   * the author can see what happened to their submission and edit it.
   */
  async getOwnReviews(
    publicId: string,
    params: { page: number; limit: number },
  ): Promise<{ reviews: ReviewResponse[]; pagination: ActivityPagination }> {
    const identity = await anonymousRepository.findByPublicId(publicId);
    if (!identity) {
      throw new AppError('Anonymous identity not found', 404);
    }
    const { data, total } = await reviewsRepository.findByAnonymousId(identity.id, params);
    return {
      reviews: data.map(toReviewResponse),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }

  /**
   * One of the caller's own reviews by publicId (any moderation status),
   * resolved against the caller's identity so it can never fetch another
   * identity's content. Returns null when not found / not owned — the
   * controller turns that into a 404.
   */
  async getOwnReview(
    publicId: string,
    callerPublicId: string,
  ): Promise<ReviewResponse | null> {
    const identity = await anonymousRepository.findByPublicId(callerPublicId);
    if (!identity) return null;
    const review = await reviewsRepository.findByPublicId(publicId);
    if (!review || review.anonymousId !== identity.id) return null;
    return toReviewResponse(review);
  }

  /** Every review authored by an identity across all time (admin-only). */
  async getAllReviews(publicId: string): Promise<ReviewResponse[]> {
    const identity = await anonymousRepository.findByPublicId(publicId);
    if (!identity) {
      throw new AppError('Identity not found', 404);
    }
    const reviews = await reviewsRepository.findAllByAnonymousId(identity.id);
    return reviews.map(toReviewResponse);
  }

  /** Aggregate of an identity's reviews, comments, votes, and reports (admin-only). */
  async getActivity(
    publicId: string,
    params: { page: number; limit: number },
  ): Promise<AnonymousActivityResponse> {
    const identity = await anonymousRepository.findByPublicId(publicId);
    if (!identity) {
      throw new AppError('Identity not found', 404);
    }

    const { page, limit } = params;
    const toPagination = (total: number): ActivityPagination => ({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });

    const [reviews, comments, votes, reports] = await Promise.all([
      reviewsRepository.findByAnonymousId(identity.id, { page, limit }),
      commentsRepository.findByAnonymousId(identity.id, { page, limit }),
      votesRepository.findByAnonymousId(identity.id, { page, limit }),
      reportsRepository.findByAnonymousId(identity.id, { page, limit }),
    ]);

    return {
      identity: toAnonymousResponse(identity),
      reviews: {
        data: reviews.data.map(toReviewResponse),
        pagination: toPagination(reviews.total),
      },
      comments: {
        data: comments.data.map(toCommentActivityItem),
        pagination: toPagination(comments.total),
      },
      votes: {
        data: votes.data.map(toVoteActivityItem),
        pagination: toPagination(votes.total),
      },
      reports: {
        data: reports.data.map(toReportActivityItem),
        pagination: toPagination(reports.total),
      },
    };
  }
}

export const anonymousService = new AnonymousService();
