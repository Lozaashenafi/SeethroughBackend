export interface TagResponse {
  id: number;
  name: string;
  slug: string;
  createdAt: Date;
}

export function toTagResponse(tag: {
  id: number;
  name: string;
  slug: string;
  createdAt: Date;
}): TagResponse {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    createdAt: tag.createdAt,
  };
}
