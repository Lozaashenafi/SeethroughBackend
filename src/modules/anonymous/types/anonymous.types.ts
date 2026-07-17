import { AnonymousIdentity } from '../../../shared/types/index.js';

export interface CreateAnonymousInput {
  publicId: string;
}

export interface AnonymousResponse {
  publicId: string;
  riskScore: number;
  isBlocked: boolean;
  createdAt: Date;
  lastSeenAt: Date;
}

export function toAnonymousResponse(identity: AnonymousIdentity): AnonymousResponse {
  return {
    publicId: identity.publicId,
    riskScore: identity.riskScore,
    isBlocked: identity.isBlocked,
    createdAt: identity.createdAt,
    lastSeenAt: identity.lastSeenAt,
  };
}
