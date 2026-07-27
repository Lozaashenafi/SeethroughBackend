export interface VoteResponse {
  reviewId: number;
  voteType: 'helpful' | 'unhelpful';
  createdAt: Date;
}

export function toVoteResponse(vote: {
  reviewId: number;
  voteType: string;
  createdAt: Date;
}): VoteResponse {
  return {
    reviewId: vote.reviewId,
    voteType: vote.voteType as 'helpful' | 'unhelpful',
    createdAt: vote.createdAt,
  };
}
