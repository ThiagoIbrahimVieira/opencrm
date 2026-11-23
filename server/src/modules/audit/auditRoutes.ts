import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant, prisma } from '../../db/prisma.js';
import { authenticateToken, requireRole } from '../../middlewares/authMiddleware.js';
import { decryptPii } from '../../utils/crypto.js';

export async function auditRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateToken);

  // GET /api/audit-logs (Exclusivo ADMIN)
  app.get('/logs', { preHandler: [requireRole(['ADMIN'])] }, async (req, reply) => {
    const logs = await withTenant(req.user!.storeId, async (tx) => {
      return await tx.auditLog.findMany({
        where: { storeId: req.user!.storeId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });

    const formatted = (logs as any[]).map((l: any) => ({
      id: l.id,
      timestamp: l.createdAt.toISOString(),
      actor: l.actorName || 'Sistema',
      actorRole: l.actorRole || 'ADMIN',
      actionType: l.action,
      actionLabel: l.action,
      targetLabel: l.targetLabel || '',
      detail: l.detail || '',
      resourceType: l.entityType,
      resourceId: l.entityId,
    }));

    return reply.send(formatted);
  });

  // GET /api/stock-ledger (Exclusivo ADMIN)
  app.get('/stock-ledger', { preHandler: [requireRole(['ADMIN'])] }, async (req, reply) => {
    const entries = await withTenant(req.user!.storeId, async (tx) => {
      return await tx.stockLedger.findMany({
        where: { storeId: req.user!.storeId },
        orderBy: { createdAt: 'desc' },
        take: 150,
      });
    });

    const formatted = (entries as any[]).map((e: any) => ({
      id: e.id,
      timestamp: e.createdAt.toISOString(),
      actor: e.actorName || 'Sistema',
      itemType: e.itemType,
      itemId: e.itemId,
      itemLabel: e.itemLabel,
      sku: e.sku || '',
      delta: e.delta,
      resultingStock: e.resultingStock || 0,
      reason: e.reason,
      note: e.note || undefined,
    }));

    return reply.send(formatted);
  });

  // POST /api/audit/reveal (Revelação pontual auditada de dado sensível)
  app.post('/reveal', async (req, reply) => {
    const schema = z.object({
      resourceType: z.enum(['CPF', 'PHONE', 'IMEI']),
      resourceId: z.string().uuid(),
    });

    const body = schema.parse(req.body);
    let revealedValue = '';
    let targetLabel = '';

    await withTenant(req.user!.storeId, async (tx) => {
      if (body.resourceType === 'CPF' || body.resourceType === 'PHONE') {
        const customer = await tx.customer.findUnique({
          where: { id: body.resourceId },
        });

        if (!customer) {
          throw new Error('Cliente não encontrado nesta loja.');
        }

        targetLabel = customer.fullName;

        if (body.resourceType === 'CPF') {
          if (!customer.cpfEncrypted) throw new Error('CPF não cadastrado.');
          revealedValue = decryptPii(customer.cpfEncrypted);
        } else {
          if (!customer.phoneEncrypted) throw new Error('Telefone não cadastrado.');
          revealedValue = decryptPii(customer.phoneEncrypted);
        }
      } else if (body.resourceType === 'IMEI') {
        const item = await tx.primaryItem.findUnique({
          where: { id: body.resourceId },
        });

        if (!item) {
          throw new Error('Item/Aparelho não encontrado nesta loja.');
        }

        targetLabel = item.title;
        revealedValue = item.imei1 || item.serialNumber || 'N/A';
      }

      // Registro obrigatório e imutável de auditoria
      await tx.auditLog.create({
        data: {
          storeId: req.user!.storeId,
          actorUserId: req.user!.userId,
          actorName: req.user!.name,
          actorRole: req.user!.role,
          action: body.resourceType === 'IMEI' ? 'REVEAL_IMEI' : 'REVEAL_PII',
          entityType: body.resourceType,
          entityId: body.resourceId,
          targetLabel,
          detail: `Revelação autorizada de ${body.resourceType} do registro ${targetLabel}`,
          ipAddress: req.ip,
          userAgent: (req.headers['user-agent'] as string) || '',
        },
      });
    });

    return reply.send({
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      revealedValue,
    });
  });
}
