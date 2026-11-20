import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant, prisma } from '../../db/prisma.js';
import { authenticateToken, requireRole } from '../../middlewares/authMiddleware.js';
import { hashPassword } from '../../utils/crypto.js';

export async function teamRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateToken);
  app.addHook('preHandler', requireRole(['ADMIN']));

  // GET /api/team - Lista membros da equipe da loja ativa
  app.get('/', async (req, reply) => {
    const storeId = req.user!.activeStoreId || req.user!.storeId;

    const memberships = await withTenant(storeId, async (tx) => {
      return await tx.storeMembership.findMany({
        where: { storeId },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      });
    });

    const formatted = memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      isActive: m.isActive,
      avatarUrl: m.user.avatarUrl,
      createdAt: m.createdAt,
    }));

    return reply.send(formatted);
  });

  // POST /api/team - Adiciona ou vincula novo membro à equipe da loja ativa
  app.post('/', async (req, reply) => {
    const storeId = req.user!.activeStoreId || req.user!.storeId!;

    const schema = z.object({
      name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres.'),
      email: z.string().email('E-mail corporativo inválido.'),
      password: z.string().min(4, 'Senha deve ter no mínimo 4 caracteres.'),
      role: z.enum(['ADMIN', 'VENDEDOR']),
    });

    const body = schema.parse(req.body);
    const email = body.email.toLowerCase().trim();

    const created = await withTenant(storeId, async (tx) => {
      // 1. Busca ou cria o usuário global
      let user = await tx.user.findUnique({
        where: { email },
      });

      if (!user) {
        const passwordHash = await hashPassword(body.password);
        user = await tx.user.create({
          data: {
            name: body.name.trim(),
            email,
            passwordHash,
          },
        });
      }

      // 2. Verifica se já existe vínculo com esta loja
      const existingMembership = await tx.storeMembership.findUnique({
        where: {
          userId_storeId: {
            userId: user.id,
            storeId,
          },
        },
      });

      if (existingMembership) {
        throw new Error('Este usuário já faz parte da equipe desta loja.');
      }

      // 3. Cria a membership
      const membership = await tx.storeMembership.create({
        data: {
          userId: user.id,
          storeId,
          role: body.role,
          isActive: true,
        },
        include: { user: true },
      });

      return membership;
    });

    return reply.status(201).send({
      id: created.id,
      userId: created.userId,
      name: created.user.name,
      email: created.user.email,
      role: created.role,
      isActive: created.isActive,
      avatarUrl: created.user.avatarUrl,
      createdAt: created.createdAt,
    });
  });

  // PATCH /api/team/:id - Atualiza permissões ou ativa/desativa membro
  app.patch('/:id', async (req, reply) => {
    const storeId = req.user!.activeStoreId || req.user!.storeId!;
    const { id } = req.params as { id: string };

    const schema = z.object({
      role: z.enum(['ADMIN', 'VENDEDOR']).optional(),
      isActive: z.boolean().optional(),
    });

    const body = schema.parse(req.body);

    const updated = await withTenant(storeId, async (tx) => {
      // Garante que o membro pertence à loja ativa
      const target = await tx.storeMembership.findFirst({
        where: { id, storeId },
      });

      if (!target) {
        throw new Error('Membro não encontrado nesta loja.');
      }

      // Impede auto-desativação do admin atual
      if (target.userId === req.user!.userId && body.isActive === false) {
        throw new Error('Você não pode desativar o seu próprio acesso ativo.');
      }

      return await tx.storeMembership.update({
        where: { id },
        data: {
          ...(body.role && { role: body.role }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        include: { user: true },
      });
    });

    return reply.send({
      id: updated.id,
      userId: updated.userId,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
      isActive: updated.isActive,
      avatarUrl: updated.user.avatarUrl,
      createdAt: updated.createdAt,
    });
  });
}
