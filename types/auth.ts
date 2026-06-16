export type PosRole = "STAFF" | "MANAGER" | "ADMIN";

export interface PosUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: PosRole | "USER";
}

export interface AuthResponse {
  accessToken: string;
  user: PosUser;
}

export const POS_ROLES: PosRole[] = ["STAFF", "MANAGER", "ADMIN"];

export function canAccessPos(role: string): role is PosRole {
  return POS_ROLES.includes(role as PosRole);
}
