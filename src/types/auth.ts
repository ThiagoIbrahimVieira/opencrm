export type UserRole = 'ADMIN' | 'VENDEDOR';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
  storeUnit: string;
}

export interface TeamMember extends AuthUser {
  active: boolean;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
