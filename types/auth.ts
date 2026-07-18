export type PosRole = "STAFF" | "MANAGER" | "ADMIN";

export interface PosStoreLocation {
  id: string;
  slug: string;
  name: string;
  isDefault: boolean;
}

export interface PosStore {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  primaryColor?: string | null;
  membershipRole: string;
  locations: PosStoreLocation[];
}

export interface PosUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: PosRole | "USER";
  stores: PosStore[];
}

export interface AuthResponse {
  accessToken: string;
  user: PosUser;
}

export const POS_ROLES: PosRole[] = ["STAFF", "MANAGER", "ADMIN"];

export function canAccessPos(role: string): role is PosRole {
  return POS_ROLES.includes(role as PosRole);
}

export function normalizePosUser(user: PosUser): PosUser {
  return {
    ...user,
    stores: Array.isArray(user.stores) ? user.stores : [],
  };
}
