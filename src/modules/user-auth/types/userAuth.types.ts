export interface UserJwtPayload {
  jti: string;
  userId: string;
  email: string;
  displayName: string;
  role: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailVerified: boolean;
  hasPassword: boolean;
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
  role: string;
  emailVerified: boolean;
  hasPassword: boolean;
  createdAt: Date;
}): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    emailVerified: user.emailVerified,
    hasPassword: user.hasPassword,
    createdAt: user.createdAt,
  };
}
