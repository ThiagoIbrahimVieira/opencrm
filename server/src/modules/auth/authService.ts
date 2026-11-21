import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { hashPassword, verifyPassword, hashToken } from '../../utils/crypto.js';
import { AuthTokenPayload, UserRole, AccountType } from '../../middlewares/authMiddleware.js';
import { AppError } from '../../utils/errors.js';

const googleClient = new OAuth2Client();

export class AuthService {
  static signAccessToken(payload: Omit<AuthTokenPayload, 'storeId'> & { storeId?: string }): string {
    const fullPayload: AuthTokenPayload = {
      ...payload,
      storeId: payload.storeId || payload.activeStoreId || '',
    };
    return jwt.sign(fullPayload, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  }

  static signRefreshToken(payload: Omit<AuthTokenPayload, 'storeId'> & { storeId?: string }, familyId: string): string {
    const fullPayload: AuthTokenPayload = {
      ...payload,
      storeId: payload.storeId || payload.activeStoreId || '',
    };
    return jwt.sign({ ...fullPayload, familyId }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  }

  /**
   * Onboarding: Cria uma nova loja e vincula o usuário autenticado (ou novo cadastro) como ADMIN.
   */
  static async registerStore(data: {
    storeName: string;
    segment: string;
    templateConfig: any;
    catalogOptions?: any;
    adminName: string;
    adminEmail: string;
    adminPassword?: string;
    existingUserId?: string;
  }) {
    const email = data.adminEmail.trim().toLowerCase();
    const storeName = data.storeName.trim() || 'Loja';
    const rawSlug = storeName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'loja';

    return await prisma.$transaction(async (tx) => {
      const existingSlug = await tx.store.findUnique({ where: { slug: rawSlug } });
      const finalSlug = existingSlug ? `${rawSlug}-${crypto.randomBytes(3).toString('hex')}` : rawSlug;

      // 1. Identidade Global do Usuário
      let user;
      if (data.existingUserId) {
        user = await tx.user.findUnique({ where: { id: data.existingUserId } });
        if (!user) throw new Error('Usuário autenticado não localizado.');
        user = await tx.user.update({
          where: { id: user.id },
          data: { accountType: 'ADMIN' },
        });
      } else {
        user = await tx.user.findUnique({ where: { email } });
        if (!user) {
          if (!data.adminPassword) {
            throw new Error('Senha obrigatória para cadastro de nova conta.');
          }
          const passwordHash = await hashPassword(data.adminPassword);
          user = await tx.user.create({
            data: {
              name: data.adminName.trim(),
              email,
              passwordHash,
              accountType: 'ADMIN',
            },
          });
        } else {
          user = await tx.user.update({
            where: { id: user.id },
            data: { accountType: 'ADMIN' },
          });
        }
      }

      // 2. Prevenção de duplicidade/fantasmas (fluxo customizado 'other' ou duplo clique rápido)
      const recentThreshold = new Date(Date.now() - 15 * 1000);
      const existingRecentMembership = await tx.storeMembership.findFirst({
        where: {
          userId: user.id,
          role: 'ADMIN',
          createdAt: { gte: recentThreshold },
          store: {
            name: storeName,
            segment: data.segment.trim(),
          },
        },
        include: { store: true },
        orderBy: { createdAt: 'desc' },
      });

      // Criação da Loja (ou reaproveitamento se acabou de ser criada nesta fração de segundos)
      const store = existingRecentMembership?.store || (await tx.store.create({
        data: {
          name: storeName,
          slug: finalSlug,
          segment: data.segment.trim(),
          templateConfig: data.templateConfig,
          catalogOptions: data.catalogOptions || {},
        },
      }));

      // 3. Vínculo como ADMIN em store_memberships
      await tx.storeMembership.upsert({
        where: {
          userId_storeId: {
            userId: user.id,
            storeId: store.id,
          },
        },
        create: {
          userId: user.id,
          storeId: store.id,
          role: 'ADMIN',
          isActive: true,
        },
        update: {
          role: 'ADMIN',
          isActive: true,
        },
      });

      // 4. Emissão de credenciais vinculadas a esta loja
      const payload: AuthTokenPayload = {
        userId: user.id,
        activeStoreId: store.id,
        storeId: store.id,
        role: 'ADMIN',
        accountType: 'ADMIN',
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      };

      const familyId = crypto.randomUUID();
      const accessToken = this.signAccessToken(payload);
      const refreshToken = this.signRefreshToken(payload, familyId);

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          storeId: store.id,
          familyId,
          tokenHash: hashToken(refreshToken),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return {
        store,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          accountType: 'ADMIN' as const,
          avatarUrl: user.avatarUrl,
          role: 'ADMIN' as UserRole,
        },
        stores: [
          {
            id: store.id,
            name: store.name,
            slug: store.slug,
            segment: store.segment,
            role: 'ADMIN',
          },
        ],
        accessToken,
        refreshToken,
      };
    });
  }

  /**
   * Autenticação padrão por E-mail + Senha.
   */
  static async login(credentials: { email: string; password: string; storeSlug?: string }) {
    const email = credentials.email.trim().toLowerCase();
    const password = credentials.password.trim();

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { store: true },
        },
      },
    });

    if (!user) {
      throw new AppError('Essa conta não existe.', 404);
    }

    if (!user.passwordHash) {
      if (user.googleSub) {
        throw new AppError('Esta conta usa acesso pelo Google.', 401);
      }
      if (user.memberships.length > 0) {
        throw new AppError(
          'Você já tem um convite de loja! Crie sua senha na aba Criar Conta ou entre com Google para ativar.',
          401
        );
      }
      throw new AppError('Esta conta usa acesso pelo Google.', 401);
    }

    const isValidPassword = await verifyPassword(user.passwordHash, password);
    if (!isValidPassword) {
      throw new AppError('Senha incorreta.', 401);
    }

    // Identifica a loja ativa
    const activeMemberships = user.memberships.filter((m) => m.isActive);
    let activeMembership = activeMemberships[0];
    if (credentials.storeSlug) {
      const match = activeMemberships.find((m) => m.store.slug === credentials.storeSlug);
      if (match) activeMembership = match;
    }

    const activeStoreId = activeMembership?.storeId || null;
    const activeRole = (activeMembership?.role as UserRole) || null;
    const needsOnboarding = activeMemberships.length === 0;

    const payload: AuthTokenPayload = {
      userId: user.id,
      activeStoreId,
      storeId: activeStoreId || '',
      role: activeRole,
      accountType: user.accountType,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };

    const familyId = crypto.randomUUID();
    const accessToken = this.signAccessToken(payload);
    const refreshToken = this.signRefreshToken(payload, familyId);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        storeId: activeStoreId,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        accountType: user.accountType,
        avatarUrl: user.avatarUrl,
        role: activeRole,
      },
      store: activeMembership?.store || null,
      stores: activeMemberships.map((m) => ({
        id: m.store.id,
        name: m.store.name,
        slug: m.store.slug,
        segment: m.store.segment,
        role: m.role,
      })),
      memberships: activeMemberships.map((m) => ({
        storeId: m.storeId,
        role: m.role,
        store: {
          id: m.store.id,
          name: m.store.name,
          slug: m.store.slug,
          segment: m.store.segment,
        },
      })),
      accessToken,
      refreshToken,
      needsOnboarding,
      needsRoleChoice: user.accountType === 'UNSET' && needsOnboarding,
    };
  }

  /**
   * Cadastro de Vendedor (Fase 2).
   * Normaliza email, cria ou atualiza usuário com senha e ativa vínculos de convite pendentes.
   */
  static async registerSeller(data: { name: string; email: string; password: string }) {
    const email = data.email.trim().toLowerCase();
    const name = data.name.trim();
    const password = data.password.trim();

    const passwordHash = await hashPassword(password);

    return await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { email },
        include: {
          memberships: {
            include: { store: true },
          },
        },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            name,
            email,
            passwordHash,
            accountType: 'VENDEDOR',
          },
          include: {
            memberships: {
              include: { store: true },
            },
          },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            name: name || user.name,
            passwordHash,
            accountType: 'VENDEDOR',
          },
          include: {
            memberships: {
              include: { store: true },
            },
          },
        });
      }

      // Se houver convites de loja para este usuário, ativa os vínculos
      const hasMemberships = user.memberships.length > 0;
      if (hasMemberships) {
        await tx.storeMembership.updateMany({
          where: { userId: user.id },
          data: { isActive: true },
        });
      }

      const activeMemberships = tx.storeMembership?.findMany
        ? await tx.storeMembership.findMany({
            where: { userId: user.id, isActive: true },
            include: { store: true },
            orderBy: { createdAt: 'asc' },
          })
        : (user.memberships || []);

      const activeMembership = activeMemberships[0] || null;
      const activeStoreId = activeMembership?.storeId || null;
      const activeRole = activeMembership ? (activeMembership.role as UserRole) : null;
      const needsStoreAccess = activeMemberships.length === 0;

      const payload: AuthTokenPayload = {
        userId: user.id,
        activeStoreId,
        storeId: activeStoreId || '',
        role: activeRole,
        accountType: 'VENDEDOR',
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      };

      const familyId = crypto.randomUUID();
      const accessToken = this.signAccessToken(payload);
      const refreshToken = this.signRefreshToken(payload, familyId);

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          storeId: activeStoreId,
          familyId,
          tokenHash: hashToken(refreshToken),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          accountType: 'VENDEDOR' as const,
          avatarUrl: user.avatarUrl,
          role: activeRole,
        },
        store: activeMembership?.store || null,
        stores: activeMemberships.map((m) => ({
          id: m.store.id,
          name: m.store.name,
          slug: m.store.slug,
          segment: m.store.segment,
          role: m.role,
        })),
        memberships: activeMemberships.map((m) => ({
          storeId: m.storeId,
          role: m.role,
          store: {
            id: m.store.id,
            name: m.store.name,
            slug: m.store.slug,
            segment: m.store.segment,
          },
        })),
        accessToken,
        refreshToken,
        needsStoreAccess,
      };
    });
  }

  /**
   * Revoga todas as sessões ativas do usuário (exceto a sessão atual se fornecida).
   */
  static async revokeOtherSessions(userId: string, currentRefreshToken?: string) {
    const whereClause: any = {
      userId,
      revokedAt: null,
    };

    if (currentRefreshToken) {
      const currentHashed = hashToken(currentRefreshToken);
      whereClause.tokenHash = { not: currentHashed };
    }

    const result = await prisma.refreshToken.updateMany({
      where: whereClause,
      data: { revokedAt: new Date() },
    });

    return { revokedCount: result.count };
  }

  /**
   * Login Rápido de Demonstração (apenas se ENABLE_DEMO_ACCOUNTS=true).
   */
  static async loginDemo(role: UserRole, storeSlug?: string) {
    if (!env.ENABLE_DEMO_ACCOUNTS) {
      throw new Error('Login de demonstração desativado em produção.');
    }

    const slug = storeSlug || 'auracell-jardins';
    const store = await prisma.store.findUnique({ where: { slug } });
    if (!store) {
      throw new Error(`Loja de demonstração '${slug}' não encontrada.`);
    }

    const membership = await prisma.storeMembership.findFirst({
      where: { storeId: store.id, role, isActive: true },
      include: { user: true, store: true },
    });

    if (!membership) {
      throw new Error(`Nenhum usuário com o perfil '${role}' encontrado nesta loja demo.`);
    }

    const accountType: AccountType = role === 'ADMIN' ? 'ADMIN' : 'VENDEDOR';
    const payload: AuthTokenPayload = {
      userId: membership.userId,
      activeStoreId: store.id,
      storeId: store.id,
      role,
      accountType,
      email: membership.user.email,
      name: membership.user.name,
      avatarUrl: membership.user.avatarUrl,
    };

    const familyId = crypto.randomUUID();
    const accessToken = this.signAccessToken(payload);
    const refreshToken = this.signRefreshToken(payload, familyId);

    await prisma.refreshToken.create({
      data: {
        userId: membership.userId,
        storeId: store.id,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        accountType,
        role,
        avatarUrl: membership.user.avatarUrl,
      },
      store,
      accessToken,
      refreshToken,
      needsOnboarding: false,
    };
  }

  /**
   * Login com Google (OAuth 2.0 / OIDC) via google-auth-library.
   */
  static async loginGoogle(idToken: string) {
    if (!env.GOOGLE_CLIENT_ID) {
      const err = new Error('Autenticação com Google não configurada no servidor (defina GOOGLE_CLIENT_ID).');
      (err as any).statusCode = 503;
      throw err;
    }

    let payloadGoogle;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
      payloadGoogle = ticket.getPayload();
    } catch {
      const err = new Error('Token do Google inválido ou expirado.');
      (err as any).statusCode = 401;
      throw err;
    }

    if (!payloadGoogle || !payloadGoogle.email) {
      const err = new Error('Falha ao obter credenciais do Google.');
      (err as any).statusCode = 401;
      throw err;
    }

    if (!payloadGoogle.email_verified) {
      const err = new Error('E-mail do Google não verificado pela conta Google.');
      (err as any).statusCode = 403;
      throw err;
    }

    const email = payloadGoogle.email.toLowerCase();
    const googleSub = payloadGoogle.sub;
    const name = payloadGoogle.name || email.split('@')[0];
    const avatarUrl = payloadGoogle.picture || null;

    // Busca usuário existente por googleSub ou email
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleSub }, { email }],
      },
      include: {
        memberships: {
          include: { store: true },
        },
      },
    });

    let needsRoleChoice = false;

    if (!user) {
      // 1º acesso (quando o usuário é criado via Google sem vínculo nem convite prévio de loja):
      // deve gravar accountType = 'UNSET' e retornar needsRoleChoice: true
      user = await prisma.user.create({
        data: {
          name,
          email,
          googleSub,
          avatarUrl,
          accountType: 'UNSET',
          passwordHash: null,
        },
        include: {
          memberships: {
            where: { isActive: true },
            include: { store: true },
          },
        },
      });
      needsRoleChoice = true;
    } else {
      // Vincula googleSub a usuário que já existia
      if (!user.googleSub) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleSub, avatarUrl: user.avatarUrl || avatarUrl },
          include: {
            memberships: {
              include: { store: true },
            },
          },
        });
      }

      // Se já existir convite prévio de um Admin para aquele e-mail (em store_memberships pendente ou membro de equipe com mesmo e-mail),
      // vincule automaticamente como VENDEDOR (accountType = 'VENDEDOR') e retorne a sessão na loja correspondente.
      if (user.memberships.length > 0) {
        await prisma.storeMembership.updateMany({
          where: { userId: user.id },
          data: { isActive: true },
        });

        if (user.accountType === 'UNSET') {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { accountType: 'VENDEDOR' },
            include: {
              memberships: {
                where: { isActive: true },
                include: { store: true },
              },
            },
          });
        }
        needsRoleChoice = false;
      } else {
        // Usuário existente sem nenhuma membership vinculada
        needsRoleChoice = user.accountType === 'UNSET';
      }
    }

    const activeMemberships = await prisma.storeMembership.findMany({
      where: { userId: user.id, isActive: true },
      include: { store: true },
      orderBy: { createdAt: 'asc' },
    });

    const hasMemberships = activeMemberships.length > 0;
    const activeMembership = hasMemberships ? activeMemberships[0] : null;
    const activeStoreId = activeMembership?.storeId || null;
    const role = activeMembership ? (activeMembership.role as UserRole) : null;

    const payload: AuthTokenPayload = {
      userId: user.id,
      activeStoreId,
      storeId: activeStoreId || '',
      role,
      accountType: user.accountType,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };

    const familyId = crypto.randomUUID();
    const accessToken = this.signAccessToken(payload);
    const refreshToken = this.signRefreshToken(payload, familyId);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        storeId: activeStoreId,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        accountType: user.accountType,
        avatarUrl: user.avatarUrl,
        role,
      },
      store: activeMembership?.store || null,
      stores: activeMemberships.map((m) => ({
        id: m.store.id,
        name: m.store.name,
        slug: m.store.slug,
        segment: m.store.segment,
        role: m.role,
      })),
      memberships: activeMemberships.map((m) => ({
        storeId: m.storeId,
        role: m.role,
        store: {
          id: m.store.id,
          name: m.store.name,
          slug: m.store.slug,
          segment: m.store.segment,
        },
      })),
      accessToken,
      refreshToken,
      needsOnboarding: !hasMemberships,
      needsRoleChoice,
    };
  }

  /**
   * Atualiza a intenção de perfil do usuário (ADMIN | VENDEDOR).
   */
  static async updateAccountType(userId: string, accountType: 'ADMIN' | 'VENDEDOR') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado.', 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { accountType },
      include: {
        memberships: {
          where: { isActive: true },
          include: { store: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const activeMembership = updatedUser.memberships[0] || null;
    const activeStoreId = activeMembership?.storeId || null;
    const activeRole = activeMembership ? (activeMembership.role as UserRole) : null;

    const payload: AuthTokenPayload = {
      userId: updatedUser.id,
      activeStoreId,
      storeId: activeStoreId || '',
      role: activeRole,
      accountType: updatedUser.accountType,
      email: updatedUser.email,
      name: updatedUser.name,
      avatarUrl: updatedUser.avatarUrl,
    };

    const familyId = crypto.randomUUID();
    const accessToken = this.signAccessToken(payload);
    const refreshToken = this.signRefreshToken(payload, familyId);

    await prisma.refreshToken.create({
      data: {
        userId: updatedUser.id,
        storeId: activeStoreId,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        accountType: updatedUser.accountType,
        avatarUrl: updatedUser.avatarUrl,
        role: activeRole,
      },
      store: activeMembership?.store || null,
      stores: updatedUser.memberships.map((m) => ({
        id: m.store.id,
        name: m.store.name,
        slug: m.store.slug,
        segment: m.store.segment,
        role: m.role,
      })),
      memberships: updatedUser.memberships.map((m) => ({
        storeId: m.storeId,
        role: m.role,
        store: {
          id: m.store.id,
          name: m.store.name,
          slug: m.store.slug,
          segment: m.store.segment,
        },
      })),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Troca segura de workspace/loja ativa com validação estrita em store_memberships.
   */
  static async switchStore(userId: string, targetStoreId: string) {
    const membership = await prisma.storeMembership.findUnique({
      where: {
        userId_storeId: {
          userId,
          storeId: targetStoreId,
        },
      },
      include: {
        user: true,
        store: true,
      },
    });

    if (!membership || !membership.isActive) {
      const err = new Error('Você não possui autorização para acessar esta loja.');
      (err as any).statusCode = 403;
      throw err;
    }

    const payload: AuthTokenPayload = {
      userId: membership.userId,
      activeStoreId: membership.storeId,
      storeId: membership.storeId,
      role: membership.role as UserRole,
      accountType: membership.user.accountType,
      email: membership.user.email,
      name: membership.user.name,
      avatarUrl: membership.user.avatarUrl,
    };

    const familyId = crypto.randomUUID();
    const accessToken = this.signAccessToken(payload);
    const refreshToken = this.signRefreshToken(payload, familyId);

    await prisma.refreshToken.create({
      data: {
        userId: membership.userId,
        storeId: membership.storeId,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      store: membership.store,
      role: membership.role as UserRole,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Rotação de Refresh Token com detecção de reuso.
   */
  static async refreshTokens(rawToken: string) {
    try {
      const decoded = jwt.verify(rawToken, env.JWT_REFRESH_SECRET) as AuthTokenPayload & { familyId: string };
      const tokenHashed = hashToken(rawToken);

      const existingRecord = await prisma.refreshToken.findFirst({
        where: { tokenHash: tokenHashed },
      });

      if (!existingRecord || existingRecord.revokedAt) {
        if (existingRecord) {
          await prisma.refreshToken.updateMany({
            where: { familyId: existingRecord.familyId },
            data: { revokedAt: new Date() },
          });
        }
        throw new Error('Tentativa de reuso de token detectada. Sessão invalidada.');
      }

      if (existingRecord.expiresAt < new Date()) {
        await prisma.refreshToken.update({
          where: { id: existingRecord.id },
          data: { revokedAt: new Date() },
        });
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          memberships: {
            where: { isActive: true },
            include: { store: true },
          },
        },
      });

      if (!user) {
        throw new Error('Usuário inexistente.');
      }

      const currentMembership = decoded.activeStoreId
        ? user.memberships.find((m) => m.storeId === decoded.activeStoreId)
        : user.memberships[0];

      const activeStoreId = currentMembership?.storeId || null;
      const role = (currentMembership?.role as UserRole) || null;

      const payload: AuthTokenPayload = {
        userId: user.id,
        activeStoreId,
        storeId: activeStoreId || '',
        role,
        accountType: user.accountType,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      };

      const newAccessToken = this.signAccessToken(payload);
      const newRefreshToken = this.signRefreshToken(payload, existingRecord.familyId);
      const newHashed = hashToken(newRefreshToken);

      const created = await prisma.refreshToken.create({
        data: {
          userId: user.id,
          storeId: activeStoreId,
          familyId: existingRecord.familyId,
          tokenHash: newHashed,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.refreshToken.update({
        where: { id: existingRecord.id },
        data: {
          revokedAt: new Date(),
          replacedById: created.id,
        },
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          accountType: user.accountType,
          avatarUrl: user.avatarUrl,
          role,
        },
        store: currentMembership?.store || null,
        stores: user.memberships.map((m) => ({
          id: m.store.id,
          name: m.store.name,
          slug: m.store.slug,
          segment: m.store.segment,
          role: m.role,
        })),
      };
    } catch (err: any) {
      throw new Error(err.message || 'Falha ao renovar credenciais.');
    }
  }

  static async logout(rawToken?: string) {
    if (rawToken) {
      const hashed = hashToken(rawToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashed },
        data: { revokedAt: new Date() },
      });
    }
  }
}
