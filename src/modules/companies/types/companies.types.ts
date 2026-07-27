export interface CompanyResponse {
  id: string;
  name: string;
  slug: string;
  industryId: string;
  website?: string | null;
  country?: string | null;
  city?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  verified: boolean;
  reviewCount: number;
  averageRating?: string | null;
  recommendationRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toCompanyResponse(company: {
  id: string;
  name: string;
  slug: string;
  industryId: string;
  website: string | null;
  country: string | null;
  city: string | null;
  description: string | null;
  logoUrl: string | null;
  verified: boolean;
  reviewCount: number;
  averageRating: string | null;
  recommendationRate: number;
  createdAt: Date;
  updatedAt: Date;
}): CompanyResponse {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    industryId: company.industryId,
    website: company.website,
    country: company.country,
    city: company.city,
    description: company.description,
    logoUrl: company.logoUrl,
    verified: company.verified,
    reviewCount: company.reviewCount,
    averageRating: company.averageRating,
    recommendationRate: company.recommendationRate,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}
