export type UserRole = 'ADMIN' | 'VENDEDOR';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
  storeUnit: string;
}

export type TeamMemberStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE';

export interface TeamMember extends AuthUser {
  active: boolean;
  createdAt: string;
  isPendingInvite?: boolean;
  status?: TeamMemberStatus;
  inviteLink?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
