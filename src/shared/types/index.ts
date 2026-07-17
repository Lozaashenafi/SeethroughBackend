export interface AnonymousIdentity {
  id: string;
  publicId: string;
  sessionTokenHash: string;
  riskScore: number;
  isBlocked: boolean;
  createdAt: Date;
  lastSeenAt: Date;
}
