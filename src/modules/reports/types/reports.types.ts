export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface ReportResponse {
  publicId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: Date;
  resolvedAt?: Date | null;
  // Context about the reported target (populated for the admin queue).
  reviewPublicId?: string | null;
  reviewTitle?: string | null;
  companyName?: string | null;
  companySlug?: string | null;
  commentPublicId?: string | null;
  commentContent?: string | null;
}

export function toReportResponse(report: {
  publicId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: Date;
  resolvedAt?: Date | null;
  reviewPublicId?: string | null;
  reviewTitle?: string | null;
  companyName?: string | null;
  companySlug?: string | null;
  commentPublicId?: string | null;
  commentContent?: string | null;
}): ReportResponse {
  return {
    publicId: report.publicId,
    reason: report.reason,
    description: report.description,
    status: report.status,
    createdAt: report.createdAt,
    resolvedAt: report.resolvedAt,
    reviewPublicId: report.reviewPublicId ?? null,
    reviewTitle: report.reviewTitle ?? null,
    companyName: report.companyName ?? null,
    companySlug: report.companySlug ?? null,
    commentPublicId: report.commentPublicId ?? null,
    commentContent: report.commentContent ?? null,
  };
}
