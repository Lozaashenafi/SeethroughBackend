export interface AnonymousIdentity {
  id: string;
  publicId: string;
  sessionTokenHash: string;
  nickname: string | null;
  nicknameRegeneratedAt: Date | null;
  tempBlockedUntil: Date | null;
  status: 'active' | 'disabled' | 'flagged';
  riskScore: number;
  isBlocked: boolean;
  createdAt: Date;
  lastSeenAt: Date;
}
