export interface CreateReviewInput {
  companySlug: string;
  title: string;
  pros?: string;
  cons?: string;
  overallRating?: number;
  workLifeBalance?: number;
  culture?: number;
  management?: number;
  compensation?: number;
  opportunities?: number;
  isCurrentEmployee?: boolean;
  employmentStatus?: 'full-time' | 'part-time' | 'contract' | 'intern' | 'freelance';
  jobTitle?: string;
  tagIds?: number[];
}

export interface ReviewResponse {
  publicId: string;
  companyId: string;
  companyName: string | null;
  companySlug: string | null;
  title: string;
  pros: string | null;
  cons: string | null;
  overallRating: number | null;
  workLifeBalance: number | null;
  culture: number | null;
  management: number | null;
  compensation: number | null;
  opportunities: number | null;
  isCurrentEmployee: boolean | null;
  employmentStatus: string | null;
  jobTitle: string | null;
  isVerified: boolean;
  status: 'published' | 'pending' | 'rejected';
  helpfulCount: number;
  unhelpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toReviewResponse(review: {
  publicId: string;
  companyId: string;
  companyName: string | null;
  companySlug: string | null;
  title: string;
  pros: string | null;
  cons: string | null;
  overallRating: number | null;
  workLifeBalance: number | null;
  culture: number | null;
  management: number | null;
  compensation: number | null;
  opportunities: number | null;
  isCurrentEmployee: boolean | null;
  employmentStatus: string | null;
  jobTitle: string | null;
  isVerified: boolean;
  status: 'published' | 'pending' | 'rejected';
  helpfulCount: number;
  unhelpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}): ReviewResponse {
  return {
    publicId: review.publicId,
    companyId: review.companyId,
    companyName: review.companyName,
    companySlug: review.companySlug,
    title: review.title,
    pros: review.pros,
    cons: review.cons,
    overallRating: review.overallRating,
    workLifeBalance: review.workLifeBalance,
    culture: review.culture,
    management: review.management,
    compensation: review.compensation,
    opportunities: review.opportunities,
    isCurrentEmployee: review.isCurrentEmployee,
    employmentStatus: review.employmentStatus,
    jobTitle: review.jobTitle,
    isVerified: review.isVerified,
    status: review.status,
    helpfulCount: review.helpfulCount,
    unhelpfulCount: review.unhelpfulCount,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}
