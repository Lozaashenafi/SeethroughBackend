export interface CommentResponse {
  publicId: string;
  reviewId: number;
  parentPublicId: string | null;
  content: string;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toCommentResponse(comment: {
  publicId: string;
  reviewId: number;
  parentPublicId?: string | null;
  content: string;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}): CommentResponse {
  return {
    publicId: comment.publicId,
    reviewId: comment.reviewId,
    parentPublicId: comment.parentPublicId ?? null,
    content: comment.content,
    helpfulCount: comment.helpfulCount,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}
