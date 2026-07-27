export interface IndustryResponse {
  id: string;
  name: string;
  slug: string;
}

export function toIndustryResponse(industry: {
  id: string;
  name: string;
  slug: string;
}): IndustryResponse {
  return {
    id: industry.id,
    name: industry.name,
    slug: industry.slug,
  };
}
