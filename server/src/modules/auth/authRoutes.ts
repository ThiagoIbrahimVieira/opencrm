import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthService } from './authService.js';
import { authenticateToken } from '../../middlewares/authMiddleware.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';

export async function authRoutes(app: FastifyInstance) {
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };

  // POST /api/auth/register-store
  app.post('/register-store', async (req, reply) => {
    const schema = z.object({
      storeName: z.string().min(2),
      segment: z.string().min(1),
      templateConfig: z.record(z.any()),
      catalogOptions: z.record(z.any()).optional(),
      adminName: z.string().min(2),
      adminEmail: z.string().email(),
      adminPassword: z.string().min(6).optional(),
    });

    const body = schema.parse(req.body);
    const result = await AuthService.registerStore(body);

    reply.setCookie('access_token', result.accessToken, { ...cookieOptions, maxAge: 15 * 60 });
    reply.setCookie('refresh_token', result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });

    return reply.status(201).send({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        accountType: result.user.accountType,
        role: result.user.role,
        avatarUrl: result.user.avatarUrl,
        storeUnit: result.store.name,
      },
      store: result.store,
      stores: result.stores,
      accessToken: result.accessToken,
    });
  });

  // POST /api/auth/register-seller
  app.post('/register-seller', async (req, reply) => {
    const schema = z.object({
      name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres.'),
      email: z.string().email('E-mail inválido.'),
      password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres.'),
    });

    const body = schema.parse(req.body);
    const result = await AuthService.registerSeller(body);

    reply.setCookie('access_token', result.accessToken, { ...cookieOptions, maxAge: 15 * 60 });
    reply.setCookie('refresh_token', result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });

    return reply.status(201).send({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        accountType: result.user.accountType,
        role: result.user.role,
        avatarUrl: result.user.avatarUrl,
        storeUnit: result.store?.name || '',
      },
      store: result.store,
      stores: result.stores,
      memberships: result.memberships,
      accessToken: result.accessToken,
      needsStoreAccess: result.needsStoreAccess,
    });
  });

  // POST /api/auth/login
  app.post('/login', async (req, reply) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
      storeSlug: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const result = await AuthService.login(body);

    reply.setCookie('access_token', result.accessToken, { ...cookieOptions, maxAge: 15 * 60 });
    reply.setCookie('refresh_token', result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });

    return reply.send({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        accountType: result.user.accountType,
        role: result.user.role,
        avatarUrl: result.user.avatarUrl,
        storeUnit: result.store?.name || '',
      },
      store: result.store,
      stores: result.stores,
      accessToken: result.accessToken,
      needsOnboarding: result.needsOnboarding,
      needsRoleChoice: result.needsRoleChoice,
    });
  });

  // POST /api/auth/login-demo
  app.post('/login-demo', async (req, reply) => {
    const schema = z.object({
      role: z.enum(['ADMIN', 'VENDEDOR']),
      storeSlug: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const result = await AuthService.loginDemo(body.role, body.storeSlug);

    reply.setCookie('access_token', result.accessToken, { ...cookieOptions, maxAge: 15 * 60 });
    reply.setCookie('refresh_token', result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });

    return reply.send({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        accountType: result.user.accountType,
        role: result.user.role,
        avatarUrl: result.user.avatarUrl,
        storeUnit: result.store?.name || '',
      },
      store: result.store,
      accessToken: result.accessToken,
      needsOnboarding: false,
    });
  });

  // POST /api/auth/google (Google OAuth 2.0 / OIDC)
  app.post('/google', async (req, reply) => {
    const schema = z.object({
      idToken: z.string().min(10, 'Token ID do Google é obrigatório.'),
    });

    const body = schema.parse(req.body);
    const result = await AuthService.loginGoogle(body.idToken);

    reply.setCookie('access_token', result.accessToken, { ...cookieOptions, maxAge: 15 * 60 });
    reply.setCookie('refresh_token', result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });

    return reply.send({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        accountType: result.user.accountType,
        role: result.user.role,
        avatarUrl: result.user.avatarUrl,
        storeUnit: result.store?.name || '',
      },
      store: result.store,
      stores: result.stores,
      memberships: result.memberships,
      accessToken: result.accessToken,
      needsOnboarding: result.needsOnboarding,
      needsRoleChoice: result.needsRoleChoice,
    });
  });

  // PATCH /api/auth/account-type
  app.patch('/account-type', { preHandler: [authenticateToken] }, async (req, reply) => {
    const schema = z.object({
      accountType: z.enum(['ADMIN', 'VENDEDOR']),
    });

    const body = schema.parse(req.body);
    const result = await AuthService.updateAccountType(req.user!.userId, body.accountType);

    reply.setCookie('access_token', result.accessToken, { ...cookieOptions, maxAge: 15 * 60 });
    reply.setCookie('refresh_token', result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });

    return reply.send({
      user: result.user,
      store: result.store,
      stores: result.stores,
      memberships: result.memberships,
      accessToken: result.accessToken,
    });
  });

  // POST /api/auth/refresh
  app.post('/refresh', async (req, reply) => {
    const refreshToken = (req.body as any)?.refreshToken || req.cookies?.refresh_token;
    if (!refreshToken) {
      return reply.status(401).send({ error: 'Refresh token não fornecido.' });
    }

    try {
      const result = await AuthService.refreshTokens(refreshToken);

      reply.setCookie('access_token', result.accessToken, { ...cookieOptions, maxAge: 15 * 60 });
      reply.setCookie('refresh_token', result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });

      return reply.send({
        accessToken: result.accessToken,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          avatarUrl: result.user.avatarUrl,
          storeUnit: result.store?.name || '',
        },
        store: result.store,
      });
    } catch (err: any) {
      reply.clearCookie('access_token', cookieOptions);
      reply.clearCookie('refresh_token', cookieOptions);
      return reply.status(401).send({ error: err.message });
    }
  });

  // POST /api/auth/logout
  app.post('/logout', async (req, reply) => {
    const refreshToken = (req.body as any)?.refreshToken || req.cookies?.refresh_token;
    await AuthService.logout(refreshToken);

    reply.clearCookie('access_token', cookieOptions);
    reply.clearCookie('refresh_token', cookieOptions);

    return reply.send({ ok: true, message: 'Sessão encerrada com sucesso.' });
  });

  // POST /api/auth/revoke-sessions
  app.post('/revoke-sessions', { preHandler: [authenticateToken] }, async (req, reply) => {
    const userId = req.user!.userId;
    const currentRefreshToken = (req.body as any)?.refreshToken || req.cookies?.refresh_token;

    const result = await AuthService.revokeOtherSessions(userId, currentRefreshToken);

    return reply.send({
      ok: true,
      message: 'Demais sessões revogadas com sucesso.',
      revokedCount: result.revokedCount,
    });
  });

  // GET /api/auth/me
  app.get('/me', { preHandler: [authenticateToken] }, async (req, reply) => {
    const userToken = req.user!;
    const activeStoreId = userToken.activeStoreId || userToken.storeId;

    const [dbUser, store, memberships] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userToken.userId },
      }),
      activeStoreId
        ? prisma.store.findUnique({
            where: { id: activeStoreId },
          })
        : null,
      prisma.storeMembership.findMany({
        where: { userId: userToken.userId, isActive: true },
        include: { store: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!dbUser) {
      return reply.status(404).send({ error: 'Usuário não localizado.' });
    }

    const activeMembership = activeStoreId
      ? memberships.find((m) => m.storeId === activeStoreId) || null
      : memberships[0] || null;

    const actualRole = activeMembership ? (activeMembership.role as any) : null;

    return reply.send({
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        accountType: dbUser.accountType,
        role: actualRole,
        avatarUrl: dbUser.avatarUrl,
        storeUnit: store?.name || '',
      },
      store,
      stores: memberships.map((m) => ({
        id: m.store.id,
        name: m.store.name,
        slug: m.store.slug,
        segment: m.store.segment,
        role: m.role,
      })),
      memberships: memberships.map((m) => ({
        storeId: m.storeId,
        role: m.role,
        store: {
          id: m.store.id,
          name: m.store.name,
          slug: m.store.slug,
          segment: m.store.segment,
        },
      })),
      needsOnboarding: memberships.length === 0,
      needsRoleChoice: dbUser.accountType === 'UNSET' && memberships.length === 0,
    });
  });
}
