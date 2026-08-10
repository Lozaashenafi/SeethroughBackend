import { AnonymousIdentity } from '../../../shared/types/index.js';
import type { ReviewResponse } from '../../reviews/types/reviews.types.js';
import type { ReportStatus } from '../../reports/types/reports.types.js';

export interface CreateAnonymousInput {
  publicId: string;
  nickname: string;
}

export interface CreateAnonymousResult {
  identity: AnonymousIdentity;
  rawSessionToken: string;
}

export interface AnonymousResponse {
  publicId: string;
  nickname: string | null;
  nicknameRegeneratedAt: Date | null;
  tempBlockedUntil: Date | null;
  status: string;
  riskScore: number;
  isBlocked: boolean;
  createdAt: Date;
  lastSeenAt: Date;
}

export function toAnonymousResponse(identity: AnonymousIdentity): AnonymousResponse {
  return {
    publicId: identity.publicId,
    nickname: identity.nickname,
    nicknameRegeneratedAt: identity.nicknameRegeneratedAt,
    tempBlockedUntil: identity.tempBlockedUntil,
    status: identity.status,
    riskScore: identity.riskScore,
    isBlocked: identity.isBlocked,
    createdAt: identity.createdAt,
    lastSeenAt: identity.lastSeenAt,
  };
}

export interface ActivityPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
  status: ReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  reviewPublicId: string | null;
  reviewTitle: string | null;
  commentPublicId: string | null;
  commentContent: string | null;
}

export interface AnonymousActivityResponse {
  identity: AnonymousResponse;
  reviews: { data: ReviewResponse[]; pagination: ActivityPagination };
  comments: { data: CommentActivityItem[]; pagination: ActivityPagination };
  votes: { data: VoteActivityItem[]; pagination: ActivityPagination };
  reports: { data: ReportActivityItem[]; pagination: ActivityPagination };
}

export function toCommentActivityItem(comment: {
  publicId: string;
  reviewPublicId: string | null;
  reviewTitle: string | null;
  companyName: string | null;
  content: string;
  helpfulCount: number;
  createdAt: Date;
}): CommentActivityItem {
  return {
    publicId: comment.publicId,
    reviewPublicId: comment.reviewPublicId,
    reviewTitle: comment.reviewTitle,
    companyName: comment.companyName,
    content: comment.content,
    helpfulCount: comment.helpfulCount,
    createdAt: comment.createdAt,
  };
}

export function toVoteActivityItem(vote: {
  reviewPublicId: string | null;
  reviewTitle: string | null;
  companyName: string | null;
  voteType: string;
  createdAt: Date;
}): VoteActivityItem {
  return {
    reviewPublicId: vote.reviewPublicId,
    reviewTitle: vote.reviewTitle,
    companyName: vote.companyName,
    voteType: vote.voteType,
    createdAt: vote.createdAt,
  };
}

export function toReportActivityItem(report: {
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
}): ReportActivityItem {
  return {
    publicId: report.publicId,
    reason: report.reason,
    description: report.description,
    status: report.status as ReportStatus,
    createdAt: report.createdAt,
    resolvedAt: report.resolvedAt,
    reviewPublicId: report.reviewPublicId,
    reviewTitle: report.reviewTitle,
    commentPublicId: report.commentPublicId,
    commentContent: report.commentContent,
  };
}
