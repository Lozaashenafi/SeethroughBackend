import { AnonymousIdentity } from '../../../shared/types/index.js';

export interface CreateAnonymousInput {
  publicId: string;
  nickname: string;
}

export interface CreateAnonymousResult {
  identity: AnonymousIdentity;
  rawSessionToken: string;
}

export interface AnonymousResponse {
  publicId: string;
  nickname: string | null;
  nicknameRegeneratedAt: Date | null;
  tempBlockedUntil: Date | null;
  status: string;
  riskScore: number;
  isBlocked: boolean;
  createdAt: Date;
  lastSeenAt: Date;
}

export function toAnonymousResponse(identity: AnonymousIdentity): AnonymousResponse {
  return {
    publicId: identity.publicId,
    nickname: identity.nickname,
    nicknameRegeneratedAt: identity.nicknameRegeneratedAt,
    tempBlockedUntil: identity.tempBlockedUntil,
    status: identity.status,
    riskScore: identity.riskScore,
    isBlocked: identity.isBlocked,
    createdAt: identity.createdAt,
    lastSeenAt: identity.lastSeenAt,
  };
}
