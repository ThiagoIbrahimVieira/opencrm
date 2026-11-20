import { AuthUser, LoginCredentials, TeamMember, UserRole } from '../types/auth';
import { apiRequest } from './apiClient';

export interface AuthStoreState {
  currentUser: AuthUser | null;
  teamMembers: TeamMember[];
}

type Listener = () => void;

const INITIAL_TEAM: TeamMember[] = [
  {
    id: 'usr-admin-01',
    name: 'Thiago Vasconcelos',
    email: 'thiago@auracell.com.br',
    role: 'ADMIN',
    initials: 'TV',
    storeUnit: 'Loja Jardins',
    active: true,
    createdAt: '2024-03-10',
  },
  {
    id: 'usr-seller-01',
    name: 'Camila Rocha',
    email: 'camila@auracell.com.br',
    role: 'VENDEDOR',
    initials: 'CR',
    storeUnit: 'Loja Jardins',
    active: true,
    createdAt: '2025-01-18',
  },
  {
    id: 'usr-seller-02',
    name: 'Matheus Prado',
    email: 'matheus@auracell.com.br',
    role: 'VENDEDOR',
    initials: 'MP',
    storeUnit: 'Loja Jardins',
    active: true,
    createdAt: '2025-09-04',
  },
];

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Isolated mock authentication & RBAC service.
 * Designed to be swapped for backend REST/GraphQL endpoints using HttpOnly session cookies
 * without touching UI components.
 */
export class AuthService {
  private state: AuthStoreState;
  private listeners: Set<Listener> = new Set();

  constructor(initialUser: AuthUser | null = null) {
    this.state = {
      currentUser: initialUser,
      teamMembers: INITIAL_TEAM.map((m) => ({ ...m })),
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  getSnapshot(): AuthStoreState {
    return this.state;
  }

  getCurrentUser(): AuthUser | null {
    return this.state.currentUser;
  }

  isAdmin(): boolean {
    return this.state.currentUser?.role === 'ADMIN';
  }

  /**
   * Authenticates an active internal team member by email and password.
   * No public self-registration exists; accounts are managed strictly by ADMIN.
   */
  login(credentials: LoginCredentials): AuthUser {
    const email = credentials.email.trim().toLowerCase();
    const password = credentials.password.trim();

    if (!email || !password) {
      throw new Error('Informe e-mail corporativo e senha para entrar.');
    }

    const member = this.state.teamMembers.find(
      (m) => m.email.toLowerCase() === email
    );

    if (!member) {
      throw new Error('Credenciais não reconhecidas na equipe AuraCell.');
    }

    if (!member.active) {
      throw new Error('Este acesso está temporariamente desativado. Contate o administrador.');
    }

    if (password.length < 4) {
      throw new Error('Senha inválida. Utilize no mínimo 4 caracteres.');
    }

    const sessionUser: AuthUser = {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      initials: member.initials,
      storeUnit: member.storeUnit,
    };

    this.state = { ...this.state, currentUser: sessionUser };
    this.notify();

    if (typeof window !== 'undefined') {
      apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }).catch(() => {});
    }

    return sessionUser;
  }

  /**
   * Quick demonstration sign-in for testing ADMIN or VENDEDOR RBAC views.
   */
  loginDemo(role: UserRole): AuthUser {
    const member =
      this.state.teamMembers.find((m) => m.role === role && m.active) ??
      this.state.teamMembers[0];

    const sessionUser: AuthUser = {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      initials: member.initials,
      storeUnit: member.storeUnit,
    };

    this.state = { ...this.state, currentUser: sessionUser };
    this.notify();

    if (typeof window !== 'undefined') {
      apiRequest('/api/auth/login-demo', {
        method: 'POST',
        body: JSON.stringify({ role }),
      }).catch(() => {});
    }

    return sessionUser;
  }

  /**
   * Switches active role during session for RBAC testing from the sidebar profile switcher.
   */
  switchRole(role: UserRole): AuthUser {
    return this.loginDemo(role);
  }

  /**
   * Google OAuth 2.0 / OIDC login via backend.
   */
  async loginGoogle(idToken: string): Promise<{ user: AuthUser; needsOnboarding: boolean }> {
    const data = await apiRequest('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });

    const user: AuthUser = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role || 'ADMIN',
      initials: buildInitials(data.user.name),
      storeUnit: data.store?.name || 'Nova Loja',
    };

    this.state = {
      ...this.state,
      currentUser: user,
    };
    this.notify();

    return { user, needsOnboarding: Boolean(data.needsOnboarding) };
  }

  async switchStore(storeId: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const data = await apiRequest('/api/stores/switch', {
        method: 'POST',
        body: JSON.stringify({ storeId }),
      });
      if (data?.store && this.state.currentUser) {
        this.state = {
          ...this.state,
          currentUser: {
            ...this.state.currentUser,
            role: data.role || this.state.currentUser.role,
            storeUnit: data.store.name,
          },
        };
        this.notify();
      }
    } catch {
      // Ignora falha de rede em dev offline
    }
  }

  logout(): void {
    this.state = { ...this.state, currentUser: null };
    this.notify();

    if (typeof window !== 'undefined') {
      apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    }
  }

  async hydrateSession(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const data = await apiRequest('/api/auth/me');
      if (data?.user) {
        this.state = {
          ...this.state,
          currentUser: {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role || 'ADMIN',
            initials: buildInitials(data.user.name),
            storeUnit: data.store?.name || data.user.storeUnit || 'Loja Jardins',
          },
        };
        this.notify();
      }
    } catch {
      // Ignora falha de sessão offline
    }
  }

  listTeamMembers(): TeamMember[] {
    return this.state.teamMembers;
  }

  /**
   * Admin-only team member provisioning.
   */
  addTeamMember(input: { name: string; email: string; role: UserRole }): TeamMember {
    if (!this.isAdmin()) {
      throw new Error('Apenas administradores podem gerenciar a equipe.');
    }

    const cleanName = input.name.trim();
    const cleanEmail = input.email.trim().toLowerCase();
    if (!cleanName || !cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Informe nome completo e e-mail corporativo válido.');
    }

    if (this.state.teamMembers.some((m) => m.email.toLowerCase() === cleanEmail)) {
      throw new Error('Já existe um membro cadastrado com este e-mail.');
    }

    const created: TeamMember = {
      id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      email: cleanEmail,
      role: input.role,
      initials: buildInitials(cleanName),
      storeUnit: 'Loja Jardins',
      active: true,
      createdAt: '2026-11-20',
    };

    this.state = {
      ...this.state,
      teamMembers: [...this.state.teamMembers, created],
    };
    this.notify();

    if (typeof window !== 'undefined') {
      apiRequest('/api/team', {
        method: 'POST',
        body: JSON.stringify({ ...input, password: 'password123' }),
      }).catch(() => {});
    }

    return created;
  }

  toggleTeamMemberActive(memberId: string): TeamMember {
    if (!this.isAdmin()) {
      throw new Error('Apenas administradores podem alterar acessos.');
    }
    if (this.state.currentUser?.id === memberId) {
      throw new Error('Você não pode desativar o próprio acesso ativo.');
    }

    let updated: TeamMember | undefined;
    this.state = {
      ...this.state,
      teamMembers: this.state.teamMembers.map((m) => {
        if (m.id === memberId) {
          updated = { ...m, active: !m.active };
          return updated;
        }
        return m;
      }),
    };
    if (!updated) throw new Error('Membro não encontrado.');
    this.notify();

    if (typeof window !== 'undefined') {
      apiRequest(`/api/team/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: updated.active }),
      }).catch(() => {});
    }

    return updated;
  }
}

export const authService = new AuthService(null);
