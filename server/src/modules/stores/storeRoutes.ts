import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant } from '../../db/prisma.js';
import { authenticateToken, requireRole } from '../../middlewares/authMiddleware.js';
import { AuthService } from '../auth/authService.js';
import { env } from '../../config/env.js';

export async function storeRoutes(app: FastifyInstance) {
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };

  // GET /api/stores/mine - Lista todas as lojas onde o usuário tem vínculo ativo
  app.get('/mine', { preHandler: [authenticateToken] }, async (req, reply) => {
    const memberships = await prisma.storeMembership.findMany({
      where: {
        userId: req.user!.userId,
        isActive: true,
      },
      include: {
        store: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return reply.send(
      memberships.map((m) => ({
        storeId: m.storeId,
        role: m.role,
        store: m.store,
      }))
    );
  });

  // POST /api/stores - Cria uma nova loja e vincula o usuário autenticado como ADMIN
  app.post('/', { preHandler: [authenticateToken] }, async (req, reply) => {
    const schema = z.object({
      name: z.string().min(2, 'Nome da loja deve ter no mínimo 2 caracteres.'),
      segment: z.string().min(2, 'Segmento é obrigatório.'),
      templateConfig: z.record(z.any()),
      catalogOptions: z.record(z.any()).optional(),
    });

    const body = schema.parse(req.body);

    const result = await AuthService.registerStore({
      storeName: body.name,
      segment: body.segment,
      templateConfig: body.templateConfig,
      adminName: req.user!.name,
      adminEmail: req.user!.email,
      existingUserId: req.user!.userId,
    });

    reply.setCookie('access_token', result.accessToken, { ...cookieOptions, maxAge: 15 * 60 });
    reply.setCookie('refresh_token', result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });

    return reply.status(201).send({
      store: result.store,
      role: 'ADMIN',
      accessToken: result.accessToken,
    });
  });

  // POST /api/stores/switch - Alterna para outra loja onde o usuário possui vínculo
  app.post('/switch', { preHandler: [authenticateToken] }, async (req, reply) => {
    const schema = z.object({
      storeId: z.string().uuid('ID de loja inválido.'),
    });

    const body = schema.parse(req.body);
    const result = await AuthService.switchStore(req.user!.userId, body.storeId);

    reply.setCookie('access_token', result.accessToken, { ...cookieOptions, maxAge: 15 * 60 });
    reply.setCookie('refresh_token', result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });

    return reply.send({
      store: result.store,
      role: result.role,
      accessToken: result.accessToken,
    });
  });

  // GET /api/stores/current
  app.get('/current', { preHandler: [authenticateToken] }, async (req, reply) => {
    const storeId = req.user!.activeStoreId || req.user!.storeId;
    if (!storeId) {
      return reply.status(403).send({
        error: 'Nenhuma loja ativa selecionada.',
        needsOnboarding: true,
      });
    }

    const store = await withTenant(storeId, async (tx) => {
      return await tx.store.findUnique({
        where: { id: storeId },
      });
    });

    if (!store) {
      return reply.status(404).send({ error: 'Loja não encontrada.' });
    }

    return reply.send(store);
  });

  // PATCH /api/stores/current (ADMIN only)
  app.patch(
    '/current',
    { preHandler: [authenticateToken, requireRole(['ADMIN'])] },
    async (req, reply) => {
      const storeId = req.user!.activeStoreId || req.user!.storeId;
      const schema = z.object({
        name: z.string().optional(),
        segment: z.string().optional(),
        templateConfig: z.record(z.any()).optional(),
        catalogOptions: z.record(z.any()).optional(),
      });

      const body = schema.parse(req.body);

      const updated = await withTenant(storeId, async (tx) => {
        return await tx.store.update({
          where: { id: storeId },
          data: body,
        });
      });

      return reply.send(updated);
    }
  );

  // GET /api/stores/demo-list
  app.get('/demo-list', async (_req, reply) => {
    const stores = await prisma.store.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        segment: true,
        templateConfig: true,
      },
    });

    return reply.send(stores);
  });
}
