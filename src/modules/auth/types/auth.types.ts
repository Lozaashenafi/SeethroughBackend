export interface LoginInput {
  email: string;
  password: string;
}

export interface AdminJwtPayload {
  adminId: number;
  email: string;
  name: string;
}

export interface LoginResponse {
  token: string;
  admin: {
    id: number;
    email: string;
    name: string;
  };
}

export function toLoginResponse(admin: { id: number; email: string; name: string }, token: string): LoginResponse {
  return {
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
    },
  };
}
