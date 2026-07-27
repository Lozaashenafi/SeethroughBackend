export interface CreateCommentInput {
  reviewPublicId: string;
  content: string;
  parentId?: number;
}

export interface CommentResponse {
  publicId: string;
  reviewId: number;
  parentId: number | null;
  content: string;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toCommentResponse(comment: {
  publicId: string;
  reviewId: number;
  parentId: number | null;
  content: string;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}): CommentResponse {
  return {
    publicId: comment.publicId,
    reviewId: comment.reviewId,
    parentId: comment.parentId,
    content: comment.content,
    helpfulCount: comment.helpfulCount,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}
