import { db } from '../../../database/db.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { adminUsersRepository } from '../repository/adminUsers.repository.js';
import { reviewsRepository } from '../../reviews/repository/reviews.repository.js';
import { commentsRepository } from '../../comments/repository/comments.repository.js';
import { votesRepository } from '../../votes/repository/votes.repository.js';
import { reportsRepository } from '../../reports/repository/reports.repository.js';
import { companiesRepository } from '../../companies/repository/companies.repository.js';
import {
  toReviewResponse,
  type ReviewResponse,
} from '../../reviews/types/reviews.types.js';
import {
  buildPagination,
  toAdminUserResponse,
  type AdminUserActivityResponse,
  type AdminUserDetailResponse,
  type AdminUserListResponse,
} from '../types/adminUsers.types.js';

interface ListParams {
  page: number;
  limit: number;
  search?: string;
  role: 'user' | 'admin' | 'all';
  status: 'active' | 'blocked' | 'restricted' | 'all';
}

class AdminUsersService {
  async list(params: ListParams): Promise<AdminUserListResponse> {
    const { data, total } = await adminUsersRepository.findAll(params);
    return {
      users: data.map(toAdminUserResponse),
      pagination: buildPagination(params.page, params.limit, total),
    };
  }

  private async requireUser(id: string) {
    const user = await adminUsersRepository.findById(id);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  async getById(id: string): Promise<AdminUserDetailResponse> {
    const user = await this.requireUser(id);
    const counts = await adminUsersRepository.getCounts(id);
    return { ...toAdminUserResponse(user), counts };
  }

  /**
   * Admins cannot block or delete themselves — that is the only way to lock
   * everyone out of the moderation tools.
   */
  private assertNotSelf(targetId: string, actingUserId: string, action: string): void {
    if (targetId === actingUserId) {
      throw new AppError(`You cannot ${action} your own account`, 400);
    }
  }

  async block(id: string, actingUserId: string) {
    const user = await this.requireUser(id);
    this.assertNotSelf(id, actingUserId, 'block');
    if (user.isBlocked) {
      throw new AppError('User is already blocked', 409);
    }
    return toAdminUserResponse((await adminUsersRepository.setBlocked(id, true))!);
  }

  async unblock(id: string, actingUserId: string) {
    const user = await this.requireUser(id);
    this.assertNotSelf(id, actingUserId, 'unblock');
    if (!user.isBlocked) {
      throw new AppError('User is not blocked', 409);
    }
    return toAdminUserResponse((await adminUsersRepository.setBlocked(id, false))!);
  }

  async tempBlock(id: string, hours: number, actingUserId: string) {
    const user = await this.requireUser(id);
    this.assertNotSelf(id, actingUserId, 'restrict');
    if (user.isBlocked) {
      throw new AppError('User is blocked. Unblock them first.', 409);
    }
    const until = new Date(Date.now() + hours * 60 * 60 * 1000);
    return toAdminUserResponse((await adminUsersRepository.setTempBlocked(id, until))!);
  }

  async clearTempBlock(id: string, actingUserId: string) {
    await this.requireUser(id);
    this.assertNotSelf(id, actingUserId, 'restrict');
    return toAdminUserResponse((await adminUsersRepository.clearTempBlock(id))!);
  }

  /** Every review by a user across all time, including pending/rejected. */
  async getAllReviews(id: string): Promise<ReviewResponse[]> {
    await this.requireUser(id);
    const reviews = await reviewsRepository.findAllByUserId(id);
    return reviews.map(toReviewResponse);
  }

  /** Reviews, comments, votes and reports by a user (admin-only). */
  async getActivity(
    id: string,
    params: { page: number; limit: number },
  ): Promise<AdminUserActivityResponse> {
    const user = await this.requireUser(id);
    const { page, limit } = params;

    const [reviews, comments, votes, reports] = await Promise.all([
      reviewsRepository.findByUserId(id, { page, limit }),
      commentsRepository.findByUserId(id, { page, limit }),
      votesRepository.findByUserId(id, { page, limit }),
      reportsRepository.findByUserId(id, { page, limit }),
    ]);

    return {
      user: toAdminUserResponse(user),
      reviews: {
        data: reviews.data.map(toReviewResponse),
        pagination: buildPagination(page, limit, reviews.total),
      },
      comments: {
        data: comments.data,
        pagination: buildPagination(page, limit, comments.total),
      },
      votes: {
        data: votes.data,
        pagination: buildPagination(page, limit, votes.total),
      },
      reports: {
        data: reports.data,
        pagination: buildPagination(page, limit, reports.total),
      },
    };
  }

  /**
   * Permanently delete a user and everything they posted. Content removal and
   * the company-stat recompute run in one transaction so the denormalized
   * counters can never drift from the remaining reviews.
   */
  async delete(id: string, actingUserId: string): Promise<void> {
    await this.requireUser(id);
    this.assertNotSelf(id, actingUserId, 'delete');

    await db.transaction(async (tx) => {
      const affectedCompanyIds = await adminUsersRepository.deleteContentWithClient(tx, id);
      await adminUsersRepository.deleteWithClient(tx, id);

      for (const companyId of affectedCompanyIds) {
        const stats = await reviewsRepository.getCompanyReviewStatsWithClient(tx, companyId);
        await companiesRepository.updateStatsWithClient(tx, companyId, stats);
      }
    });
  }
}

export const adminUsersService = new AdminUsersService();
