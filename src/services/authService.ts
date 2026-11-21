import { AuthUser, LoginCredentials, TeamMember, UserRole } from '../types/auth';
import { apiRequest } from './apiClient';

export interface RegisterStoreInput {
  adminName: string;
  adminEmail: string;
  adminPassword?: string;
  storeName: string;
  segment: string;
  templateConfig?: any;
}

export interface RegisterSellerInput {
  name: string;
  email: string;
  password?: string;
}

export interface AuthStoreState {
  currentUser: AuthUser | null;
  teamMembers: TeamMember[];
  isDemoMode: boolean;
  needsRoleChoice?: boolean;
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
    isPendingInvite: false,
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
    isPendingInvite: false,
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
    isPendingInvite: false,
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

  constructor(initialUser: AuthUser | null = null, isDemoMode = false) {
    this.state = {
      currentUser: initialUser,
      teamMembers: INITIAL_TEAM.map((m) => ({ ...m })),
      isDemoMode,
      needsRoleChoice: false,
    };
  }

  isDemoMode(): boolean {
    return this.state.isDemoMode;
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
      throw new Error('Credenciais não reconhecidas. Verifique e-mail e senha ou crie uma conta gratuita.');
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
      accountType: member.role,
      initials: member.initials,
      storeUnit: member.storeUnit,
    };

    this.state = { ...this.state, currentUser: sessionUser, isDemoMode: false, needsRoleChoice: false };
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
   * Authenticates against local team or the backend /api/auth/login route.
   */
  async loginWithBackend(credentials: LoginCredentials): Promise<AuthUser> {
    const email = credentials.email.trim().toLowerCase();
    const password = credentials.password.trim();

    if (!email || !password) {
      throw new Error('Informe e-mail e senha para entrar.');
    }

    // Se existe na equipe local conhecida (ex: demo accounts)
    const localMember = this.state.teamMembers.find((m) => m.email.toLowerCase() === email);
    if (localMember) {
      return this.login(credentials);
    }

    // Tenta autenticar na API
    if (typeof window !== 'undefined') {
      try {
        const data = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        if (data?.user) {
          const accountType = data.user.accountType || (data.needsRoleChoice ? 'UNSET' : (data.user.role || 'ADMIN'));
          const role = data.user.role || (accountType === 'ADMIN' ? 'ADMIN' : (accountType === 'VENDEDOR' ? 'VENDEDOR' : 'ADMIN'));
          const sessionUser: AuthUser = {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role,
            accountType,
            initials: buildInitials(data.user.name),
            storeUnit: data.store?.name || (data.stores?.length > 0 ? data.stores[0].name : (accountType === 'VENDEDOR' ? 'Aguardando vínculo' : 'Workspace')),
          };

          const newMember: TeamMember = {
            id: sessionUser.id,
            name: sessionUser.name,
            email: sessionUser.email,
            role: sessionUser.role,
            accountType: sessionUser.accountType,
            initials: sessionUser.initials,
            storeUnit: sessionUser.storeUnit,
            active: true,
            isPendingInvite: false,
            createdAt: new Date().toISOString().split('T')[0],
          };

          this.state = {
            ...this.state,
            currentUser: sessionUser,
            isDemoMode: false,
            needsRoleChoice: Boolean(data.needsRoleChoice || accountType === 'UNSET'),
            teamMembers: [...this.state.teamMembers.filter((m) => m.email !== email), newMember],
          };
          this.notify();

          return sessionUser;
        }
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (/não existe|not found|usuário não encontrado|credenciais não reconhecidas/i.test(msg)) {
          throw new Error('Essa conta não existe.');
        }
        if (/senha incorreta|invalid password|senha inválida/i.test(msg)) {
          throw new Error('Senha incorreta.');
        }
        if (/google|oauth|gsi/i.test(msg)) {
          throw new Error('Esta conta usa acesso pelo Google.');
        }
        throw new Error(err.message || 'Credenciais não reconhecidas. Verifique e-mail e senha.');
      }
    }

    throw new Error('Essa conta não existe.');
  }

  /**
   * Registers a brand new store and its initial administrator account.
   */
  async registerStore(input: RegisterStoreInput): Promise<AuthUser> {
    const adminName = input.adminName.trim();
    const adminEmail = input.adminEmail.trim().toLowerCase();
    const storeName = input.storeName.trim();
    const segment = input.segment.trim() || 'Varejo Geral';
    const adminPassword = input.adminPassword?.trim() || 'password123';

    if (!adminName || !adminEmail || !storeName) {
      throw new Error('Informe seu nome, e-mail e o nome da loja.');
    }

    if (!adminEmail.includes('@')) {
      throw new Error('Informe um endereço de e-mail corporativo ou pessoal válido.');
    }

    if (adminPassword.length < 6) {
      throw new Error('A senha deve conter no mínimo 6 caracteres.');
    }

    let user: AuthUser;

    if (typeof window !== 'undefined') {
      try {
        const res = await apiRequest('/api/auth/register-store', {
          method: 'POST',
          body: JSON.stringify({
            storeName,
            segment,
            templateConfig: input.templateConfig || {},
            adminName,
            adminEmail,
            adminPassword,
          }),
        });

        if (res?.user) {
          user = {
            id: res.user.id,
            name: res.user.name,
            email: res.user.email,
            role: 'ADMIN',
            accountType: 'ADMIN',
            initials: buildInitials(res.user.name),
            storeUnit: res.store?.name || storeName,
          };
        } else {
          throw new Error('Resposta inesperada do servidor.');
        }
      } catch (err: any) {
        console.warn('Falha na API de registro, utilizando fallback de sessão local:', err);
        user = {
          id: `usr-admin-${Date.now()}`,
          name: adminName,
          email: adminEmail,
          role: 'ADMIN',
          accountType: 'ADMIN',
          initials: buildInitials(adminName),
          storeUnit: storeName,
        };
      }
    } else {
      user = {
        id: `usr-admin-${Date.now()}`,
        name: adminName,
        email: adminEmail,
        role: 'ADMIN',
        accountType: 'ADMIN',
        initials: buildInitials(adminName),
        storeUnit: storeName,
      };
    }

    const member: TeamMember = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'ADMIN',
      accountType: 'ADMIN',
      initials: user.initials,
      storeUnit: user.storeUnit,
      active: true,
      isPendingInvite: false,
      createdAt: new Date().toISOString().split('T')[0],
    };

    this.state = {
      ...this.state,
      currentUser: user,
      isDemoMode: false,
      needsRoleChoice: false,
      teamMembers: [...this.state.teamMembers.filter((m) => m.email !== user.email), member],
    };
    this.notify();

    return user;
  }

  /**
   * Registers a seller account seeking to join an existing store.
   */
  async registerSeller(input: RegisterSellerInput): Promise<AuthUser> {
    const cleanName = input.name.trim();
    const cleanEmail = input.email.trim().toLowerCase();
    const password = input.password?.trim() || 'password123';

    if (!cleanName || !cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Informe seu nome completo e um e-mail válido.');
    }

    if (password.length < 6) {
      throw new Error('A senha deve conter no mínimo 6 caracteres.');
    }

    let user: AuthUser;

    if (typeof window !== 'undefined') {
      try {
        const res = await apiRequest('/api/auth/register-seller', {
          method: 'POST',
          body: JSON.stringify({
            name: cleanName,
            email: cleanEmail,
            password,
          }),
        });

        if (res?.user) {
          user = {
            id: res.user.id,
            name: res.user.name,
            email: res.user.email,
            role: 'VENDEDOR',
            accountType: 'VENDEDOR',
            initials: buildInitials(res.user.name),
            storeUnit: res.store?.name || 'Aguardando vínculo',
          };
        } else {
          throw new Error('Resposta inesperada do servidor.');
        }
      } catch (err: any) {
        console.warn('Falha na API de registro de vendedor, utilizando fallback:', err);
        user = {
          id: `usr-seller-${Date.now()}`,
          name: cleanName,
          email: cleanEmail,
          role: 'VENDEDOR',
          accountType: 'VENDEDOR',
          initials: buildInitials(cleanName),
          storeUnit: 'Aguardando vínculo',
        };
      }
    } else {
      user = {
        id: `usr-seller-${Date.now()}`,
        name: cleanName,
        email: cleanEmail,
        role: 'VENDEDOR',
        accountType: 'VENDEDOR',
        initials: buildInitials(cleanName),
        storeUnit: 'Aguardando vínculo',
      };
    }

    const member: TeamMember = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'VENDEDOR',
      accountType: 'VENDEDOR',
      initials: user.initials,
      storeUnit: user.storeUnit,
      active: true,
      isPendingInvite: true,
      createdAt: new Date().toISOString().split('T')[0],
    };

    this.state = {
      ...this.state,
      currentUser: user,
      isDemoMode: false,
      needsRoleChoice: false,
      teamMembers: [...this.state.teamMembers.filter((m) => m.email !== user.email), member],
    };
    this.notify();

    return user;
  }

  /**
   * Rechecks current user session and stores via backend.
   */
  async refreshUserAndStores(): Promise<{ user: AuthUser | null; storesCount: number }> {
    if (typeof window === 'undefined') {
      return { user: this.state.currentUser, storesCount: 0 };
    }
    try {
      const meData = await apiRequest('/api/auth/me');
      let storesCount = 0;
      try {
        const storesData = await apiRequest('/api/stores/mine');
        if (Array.isArray(storesData)) {
          storesCount = storesData.length;
        }
      } catch {}

      if (meData?.user) {
        const updatedUser: AuthUser = {
          id: meData.user.id,
          name: meData.user.name,
          email: meData.user.email,
          role: meData.user.role || this.state.currentUser?.role || 'VENDEDOR',
          initials: buildInitials(meData.user.name),
          storeUnit: meData.store?.name || (storesCount > 0 ? 'Loja Ativa' : 'Aguardando vínculo'),
        };
        this.state = {
          ...this.state,
          currentUser: updatedUser,
        };
        this.notify();
        return { user: updatedUser, storesCount };
      }
    } catch (err) {
      console.warn('Erro ao atualizar sessão e lojas:', err);
    }
    return { user: this.state.currentUser, storesCount: 0 };
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
      accountType: member.role,
      initials: member.initials,
      storeUnit: member.storeUnit,
    };

    this.state = { ...this.state, currentUser: sessionUser, isDemoMode: true, needsRoleChoice: false };
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
  async loginGoogle(idToken: string): Promise<{ user: AuthUser; needsOnboarding: boolean; needsRoleChoice: boolean }> {
    const data = await apiRequest('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });

    const accountType = data.user.accountType || (data.needsRoleChoice ? 'UNSET' : (data.user.role || 'ADMIN'));
    const role = data.user.role || (accountType === 'ADMIN' ? 'ADMIN' : (accountType === 'VENDEDOR' ? 'VENDEDOR' : 'ADMIN'));
    const needsRoleChoice = Boolean(data.needsRoleChoice || accountType === 'UNSET');

    const user: AuthUser = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role,
      accountType,
      initials: buildInitials(data.user.name),
      storeUnit: data.store?.name || (data.stores?.length > 0 ? data.stores[0].name : (accountType === 'VENDEDOR' ? 'Aguardando vínculo' : 'Nova Loja')),
    };

    this.state = {
      ...this.state,
      currentUser: user,
      isDemoMode: false,
      needsRoleChoice,
    };
    this.notify();

    return { user, needsOnboarding: Boolean(data.needsOnboarding), needsRoleChoice };
  }

  /**
   * Atualiza a intenção de perfil do usuário (ADMIN ou VENDEDOR) no backend e no estado local.
   */
  async setAccountType(accountType: 'ADMIN' | 'VENDEDOR'): Promise<AuthUser> {
    if (typeof window !== 'undefined') {
      try {
        const data = await apiRequest('/api/auth/account-type', {
          method: 'PATCH',
          body: JSON.stringify({ accountType }),
        });
        if (data?.user && this.state.currentUser) {
          const updatedUser: AuthUser = {
            ...this.state.currentUser,
            role: accountType,
            accountType,
          };
          this.state = {
            ...this.state,
            currentUser: updatedUser,
            needsRoleChoice: false,
          };
          this.notify();
          return updatedUser;
        }
      } catch (err) {
        console.warn('Falha na API account-type, atualizando estado local:', err);
      }
    }

    if (this.state.currentUser) {
      const updatedUser: AuthUser = {
        ...this.state.currentUser,
        role: accountType,
        accountType,
      };
      this.state = {
        ...this.state,
        currentUser: updatedUser,
        needsRoleChoice: false,
      };
      this.notify();
      return updatedUser;
    }
    throw new Error('Nenhum usuário ativo para definir papel.');
  }

  /**
   * Permite reabrir a seleção de perfil (ADMIN / VENDEDOR).
   */
  setNeedsRoleChoice(needs: boolean): void {
    this.state = {
      ...this.state,
      needsRoleChoice: needs,
    };
    this.notify();
  }

  async switchStore(storeId: string): Promise<void> {
    if (this.isDemoMode()) {
      return;
    }
    if (typeof window !== 'undefined') {
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
  }

  logout(): void {
    this.state = { ...this.state, currentUser: null, isDemoMode: false, needsRoleChoice: false };
    this.notify();

    if (typeof window !== 'undefined') {
      apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    }
  }

  /**
   * Revokes all other active sessions for the current authenticated user.
   */
  async revokeOtherSessions(): Promise<{ ok: boolean; message: string; revokedCount: number }> {
    if (typeof window !== 'undefined') {
      try {
        return await apiRequest('/api/auth/revoke-sessions', { method: 'POST' });
      } catch (err: any) {
        throw new Error(err.message || 'Falha ao revogar demais sessões.');
      }
    }
    return { ok: true, message: 'Demais sessões revogadas com sucesso.', revokedCount: 0 };
  }

  async hydrateSession(): Promise<AuthUser | null> {
    if (typeof window === 'undefined') return null;
    try {
      const data = await apiRequest('/api/auth/me');
      if (data?.user) {
        const accountType = data.user.accountType || (data.needsRoleChoice ? 'UNSET' : (data.user.role || 'ADMIN'));
        const role = data.user.role || (accountType === 'ADMIN' ? 'ADMIN' : (accountType === 'VENDEDOR' ? 'VENDEDOR' : 'VENDEDOR'));
        const needsRoleChoice = Boolean(data.needsRoleChoice || accountType === 'UNSET');

        const sessionUser: AuthUser = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role,
          accountType,
          initials: buildInitials(data.user.name),
          storeUnit: data.store?.name || (data.stores?.length > 0 ? data.stores[0].name : (accountType === 'VENDEDOR' ? 'Aguardando vínculo' : '')),
        };
        this.state = {
          ...this.state,
          currentUser: sessionUser,
          isDemoMode: false,
          needsRoleChoice,
        };
        this.notify();
        return sessionUser;
      }
    } catch {
      // Ignora falha de sessão offline
    }
    return null;
  }

  listTeamMembers(): TeamMember[] {
    return this.state.teamMembers;
  }

  /**
   * Admin-only team member provisioning.
   */
  addTeamMember(input: { name: string; email: string; role: UserRole; password?: string }): TeamMember {
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
      storeUnit: this.state.currentUser?.storeUnit || 'Loja Jardins',
      active: true,
      isPendingInvite: input.role === 'VENDEDOR',
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
        body: JSON.stringify({ ...input, password: input.password || 'password123' }),
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
