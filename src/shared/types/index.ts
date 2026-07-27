export interface AnonymousIdentity {
  id: string;
  publicId: string;
  sessionTokenHash: string;
  status: 'active' | 'disabled' | 'flagged';
  riskScore: number;
  isBlocked: boolean;
  createdAt: Date;
  lastSeenAt: Date;
}
