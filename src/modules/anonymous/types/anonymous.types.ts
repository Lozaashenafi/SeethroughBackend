import { AnonymousIdentity } from '../../../shared/types/index.js';

export interface CreateAnonymousInput {
  publicId: string;
}

export interface CreateAnonymousResult {
  identity: AnonymousIdentity;
  rawSessionToken: string;
}

export interface AnonymousResponse {
  publicId: string;
  status: string;
  riskScore: number;
  isBlocked: boolean;
  createdAt: Date;
  lastSeenAt: Date;
}

export function toAnonymousResponse(identity: AnonymousIdentity): AnonymousResponse {
  return {
    publicId: identity.publicId,
    status: identity.status,
    riskScore: identity.riskScore,
    isBlocked: identity.isBlocked,
    createdAt: identity.createdAt,
    lastSeenAt: identity.lastSeenAt,
  };
}
