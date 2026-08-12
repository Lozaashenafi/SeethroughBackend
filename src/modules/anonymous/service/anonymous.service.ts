import { nanoid } from 'nanoid';
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
  async create(): Promise<CreateAnonymousResult> {
    const publicId = nanoid(ANONYMOUS_ID_LENGTH);
    return anonymousRepository.create({ publicId, nickname: generateNickname() });
  }

  async findByPublicId(publicId: string): Promise<AnonymousIdentity | null> {
    if (!publicId) return null;
    return anonymousRepository.findByPublicId(publicId);
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

    const next = requested || generateNickname();
    return anonymousRepository.updateNickname(identity.id, next);
  }

  /** Backfill a nickname for identities created before nicknames existed. */
  async ensureNickname(identity: AnonymousIdentity): Promise<AnonymousIdentity> {
    if (identity.nickname) return identity;
    // Backfill must NOT consume the identity's one-time regeneration right
    // (updateNickname sets nicknameRegeneratedAt), so use the dedicated method.
    return anonymousRepository.backfillNickname(identity.id, generateNickname());
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
