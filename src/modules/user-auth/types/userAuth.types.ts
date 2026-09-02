export interface UserJwtPayload {
  jti: string;
  userId: string;
  email: string;
  displayName: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  showDisplayName: boolean;
  createdAt: Date;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface GoogleCallbackInput {
  idToken: string;
}

export function toUserProfile(user: {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  showDisplayName: boolean;
  createdAt: Date;
}): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    showDisplayName: user.showDisplayName,
    createdAt: user.createdAt,
  };
}
