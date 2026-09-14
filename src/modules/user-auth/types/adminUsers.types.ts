import type { ReviewResponse } from '../../reviews/types/reviews.types.js';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * A user account as exposed to admins. Deliberately excludes passwordHash,
 * googleId and the verification/reset tokens — the admin UI never needs them
 * and they must not travel over the wire.
 */
export interface AdminUserResponse {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailVerified: boolean;
  isBlocked: boolean;
  blockedAt: Date | null;
  tempBlockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserListResponse {
  users: AdminUserResponse[];
  pagination: Pagination;
}

export interface AdminUserDetailResponse extends AdminUserResponse {
  counts: {
    reviews: number;
    comments: number;
    votes: number;
    reports: number;
  };
}

export interface CommentActivityItem {
  publicId: string;
  reviewPublicId: string | null;
  reviewTitle: string | null;
  companyName: string | null;
  content: string;
  helpfulCount: number;
  createdAt: Date;
}

export interface VoteActivityItem {
  reviewPublicId: string | null;
  reviewTitle: string | null;
  companyName: string | null;
  voteType: string;
  createdAt: Date;
}

export interface ReportActivityItem {
  publicId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
  reviewPublicId: string | null;
  reviewTitle: string | null;
  commentPublicId: string | null;
  commentContent: string | null;
}

/** Everything one user has posted, for the admin user detail page. */
export interface AdminUserActivityResponse {
  user: AdminUserResponse;
  reviews: { data: ReviewResponse[]; pagination: Pagination };
  comments: { data: CommentActivityItem[]; pagination: Pagination };
  votes: { data: VoteActivityItem[]; pagination: Pagination };
  reports: { data: ReportActivityItem[]; pagination: Pagination };
}

export function buildPagination(page: number, limit: number, total: number): Pagination {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export function toAdminUserResponse(user: {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailVerified: boolean;
  isBlocked: boolean;
  blockedAt: Date | null;
  tempBlockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminUserResponse {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    emailVerified: user.emailVerified,
    isBlocked: user.isBlocked,
    blockedAt: user.blockedAt,
    tempBlockedUntil: user.tempBlockedUntil,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
