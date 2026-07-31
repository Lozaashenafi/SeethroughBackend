export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface ReportResponse {
  publicId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: Date;
  resolvedAt?: Date | null;
}

export function toReportResponse(report: {
  publicId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: Date;
  resolvedAt?: Date | null;
}): ReportResponse {
  return {
    publicId: report.publicId,
    reason: report.reason,
    description: report.description,
    status: report.status,
    createdAt: report.createdAt,
    resolvedAt: report.resolvedAt,
  };
}
