export interface AdminJwtPayload {
  adminId: number;
  email: string;
  name: string;
}

export interface LoginResponse {
  admin: {
    id: number;
    email: string;
    name: string;
  };
}

export function toLoginResponse(admin: { id: number; email: string; name: string }): LoginResponse {
  return {
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
    },
  };
}
