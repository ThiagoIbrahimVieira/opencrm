import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant, prisma } from '../../db/prisma.js';
import { authenticateToken, requireRole } from '../../middlewares/authMiddleware.js';
import { buildCustomAttributesSchema } from '../../utils/templateValidator.js';
import { validateIMEI } from '../../utils/luhn.js';
import { maskImei } from '../../utils/crypto.js';

export async function inventoryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateToken);

  // Helper DTO Sanitizer: Se o usuário não for ADMIN, remove o custo confidencial
  function sanitizePrimaryItem(item: any, isAdmin: boolean) {
    const { costPriceCents, ...rest } = item;
    return {
      ...rest,
      costPrice: isAdmin ? costPriceCents / 100 : undefined,
      salePrice: item.salePriceCents / 100,
    };
  }

  function sanitizeSecondaryItem(item: any, isAdmin: boolean) {
    const { costPriceCents, ...rest } = item;
    return {
      ...rest,
      costPrice: isAdmin ? costPriceCents / 100 : undefined,
      price: item.salePriceCents / 100,
      stock: item.stockQty,
      minStock: item.minStockAlert,
    };
  }

  // GET /api/inventory/primary
  app.get('/primary', async (req, reply) => {
    const isAdmin = req.user!.role === 'ADMIN';

    const items = await withTenant(req.user!.storeId, async (tx) => {
      return await tx.primaryItem.findMany({
        where: { storeId: req.user!.storeId },
        include: { model: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    return reply.send(items.map((i) => sanitizePrimaryItem(i, isAdmin)));
  });

  // POST /api/inventory/primary
  app.post('/primary', async (req, reply) => {
    const schema = z.object({
      title: z.string().min(1),
      skuCode: z.string().min(1),
      isSerialized: z.boolean().default(true),
      stockQty: z.number().int().min(0).default(1),
      modelId: z.string().uuid().optional().nullable(),
      imei1: z.string().optional().nullable(),
      imei2: z.string().optional().nullable(),
      serialNumber: z.string().optional().nullable(),
      storageGb: z.string().optional().nullable(),
      ramGb: z.string().optional().nullable(),
      color: z.string().optional().nullable(),
      condition: z.string().optional().nullable(),
      batteryHealth: z.number().int().min(0).max(100).optional().nullable(),
      batteryCycles: z.number().int().min(0).optional().nullable(),
      originType: z.string().optional().nullable(),
      tradeInCustomerId: z.string().uuid().optional().nullable(),
      costPrice: z.number().min(0).default(0),
      salePrice: z.number().min(0).default(0),
      status: z.enum(['DISPONIVEL', 'RESERVADO', 'EM_AVALIACAO', 'VENDIDO', 'ESGOTADO']).default('DISPONIVEL'),
      checklist: z.array(z.any()).default([]),
      customAttributes: z.record(z.any()).default({}),
      expiresAt: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    });

    const body = schema.parse(req.body);

    // Validação de IMEI com Luhn para itens serializados (FAIL-FAST antes de qualquer I/O de banco)
    if (body.isSerialized && body.imei1) {
      const imeiCheck = validateIMEI(body.imei1);
      if (!imeiCheck.valid) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: imeiCheck.reason || 'Dígito verificador do IMEI inválido (algoritmo de Luhn).',
        });
      }
    }

    const store = await prisma.store.findUnique({ where: { id: req.user!.storeId } });
    if (!store) return reply.status(404).send({ error: 'Loja não encontrada.' });

    const templateConfig = store.templateConfig as any;
    const customAttributesSchema = buildCustomAttributesSchema(templateConfig?.primaryFields || []);

    // Validação dinâmica dos campos do template
    const parsedCustom = customAttributesSchema.safeParse(body.customAttributes);
    if (!parsedCustom.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Atributos customizados inválidos para o template da loja.',
        details: parsedCustom.error.format(),
      });
    }

    const created = await withTenant(req.user!.storeId, async (tx) => {
      const item = await tx.primaryItem.create({
        data: {
          storeId: req.user!.storeId,
          modelId: body.modelId,
          title: body.title,
          skuCode: body.skuCode,
          isSerialized: body.isSerialized,
          stockQty: body.isSerialized ? 1 : body.stockQty,
          imei1: body.imei1,
          imei2: body.imei2,
          serialNumber: body.serialNumber,
          storageGb: body.storageGb,
          ramGb: body.ramGb,
          color: body.color,
          condition: body.condition,
          batteryHealth: body.batteryHealth,
          batteryCycles: body.batteryCycles,
          originType: body.originType,
          tradeInCustomerId: body.tradeInCustomerId,
          costPriceCents: Math.round(body.costPrice * 100),
          salePriceCents: Math.round(body.salePrice * 100),
          status: body.status,
          checklistJson: body.checklist,
          customAttributes: body.customAttributes,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          notes: body.notes,
        },
      });

      // Grava no Stock Ledger
      await tx.stockLedger.create({
        data: {
          storeId: req.user!.storeId,
          itemType: 'Aparelho',
          itemId: item.id,
          itemLabel: item.title,
          sku: item.skuCode,
          delta: item.stockQty,
          resultingStock: item.stockQty,
          reason: body.originType === 'Troca de Cliente (Trade-in)' ? 'Trade-in' : 'Entrada',
          actorUserId: req.user!.userId,
          actorName: req.user!.name,
        },
      });

      // Grava em Audit Logs
      await tx.auditLog.create({
        data: {
          storeId: req.user!.storeId,
          actorUserId: req.user!.userId,
          actorName: req.user!.name,
          actorRole: req.user!.role,
          action: 'CREATE_SMARTPHONE',
          entityType: 'SMARTPHONE',
          entityId: item.id,
          targetLabel: item.title,
          detail: `Cadastrado item ${item.title} (SKU: ${item.skuCode})`,
        },
      });

      return item;
    });

    return reply.status(201).send(sanitizePrimaryItem(created, req.user!.role === 'ADMIN'));
  });

  // POST /api/inventory/primary/:id/restock
  app.post('/primary/:id/restock', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      delta: z.number().int().min(1),
      notes: z.string().optional(),
    });

    const body = schema.parse(req.body);

    const updated = await withTenant(req.user!.storeId, async (tx) => {
      const item = await tx.primaryItem.findUnique({ where: { id } });
      if (!item) throw new Error('Item não encontrado.');
      if (item.isSerialized) throw new Error('Itens serializados não suportam reposição por quantidade.');

      const newQty = item.stockQty + body.delta;
      const updatedItem = await tx.primaryItem.update({
        where: { id },
        data: {
          stockQty: newQty,
          status: newQty > 0 ? 'DISPONIVEL' : 'ESGOTADO',
        },
      });

      await tx.stockLedger.create({
        data: {
          storeId: req.user!.storeId,
          itemType: 'Aparelho',
          itemId: id,
          itemLabel: item.title,
          sku: item.skuCode,
          delta: body.delta,
          resultingStock: newQty,
          reason: 'Reposição',
          note: body.notes,
          actorUserId: req.user!.userId,
          actorName: req.user!.name,
        },
      });

      await tx.auditLog.create({
        data: {
          storeId: req.user!.storeId,
          actorUserId: req.user!.userId,
          actorName: req.user!.name,
          actorRole: req.user!.role,
          action: 'RESTOCK',
          entityType: 'SMARTPHONE',
          entityId: id,
          targetLabel: item.title,
          detail: `Reposição de +${body.delta} unidades. Novo estoque: ${newQty}`,
        },
      });

      return updatedItem;
    });

    return reply.send(sanitizePrimaryItem(updated, req.user!.role === 'ADMIN'));
  });

  // GET /api/inventory/secondary
  app.get('/secondary', async (req, reply) => {
    const isAdmin = req.user!.role === 'ADMIN';

    const items = await withTenant(req.user!.storeId, async (tx) => {
      return await tx.secondaryItem.findMany({
        where: { storeId: req.user!.storeId },
        include: { compatibilities: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    return reply.send(items.map((i) => sanitizeSecondaryItem(i, isAdmin)));
  });

  // POST /api/inventory/secondary
  app.post('/secondary', async (req, reply) => {
    const schema = z.object({
      sku: z.string().min(1),
      ean: z.string().optional().nullable(),
      brand: z.string().optional().nullable(),
      name: z.string().min(1),
      category: z.string().min(1),
      stockQty: z.number().int().min(0).default(0),
      minStockAlert: z.number().int().min(0).default(5),
      costPrice: z.number().min(0).default(0),
      price: z.number().min(0).default(0),
      customAttributes: z.record(z.any()).default({}),
      expiresAt: z.string().optional().nullable(),
      compatibleModelIds: z.array(z.string().uuid()).default([]),
    });

    const body = schema.parse(req.body);

    const created = await withTenant(req.user!.storeId, async (tx) => {
      const item = await tx.secondaryItem.create({
        data: {
          storeId: req.user!.storeId,
          sku: body.sku,
          ean: body.ean,
          brand: body.brand,
          name: body.name,
          category: body.category,
          stockQty: body.stockQty,
          minStockAlert: body.minStockAlert,
          costPriceCents: Math.round(body.costPrice * 100),
          salePriceCents: Math.round(body.price * 100),
          customAttributes: body.customAttributes,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        },
      });

      if (body.compatibleModelIds.length > 0) {
        for (const modelId of body.compatibleModelIds) {
          await tx.itemCompatibility.create({
            data: {
              storeId: req.user!.storeId,
              secondaryItemId: item.id,
              deviceModelId: modelId,
              compatibleTag: 'Compatível',
            },
          });
        }
      }

      await tx.stockLedger.create({
        data: {
          storeId: req.user!.storeId,
          itemType: 'Acessório',
          itemId: item.id,
          itemLabel: item.name,
          sku: item.sku,
          delta: item.stockQty,
          resultingStock: item.stockQty,
          reason: 'Entrada',
          actorUserId: req.user!.userId,
          actorName: req.user!.name,
        },
      });

      return item;
    });

    return reply.status(201).send(sanitizeSecondaryItem(created, req.user!.role === 'ADMIN'));
  });

  // POST /api/inventory/secondary/:id/restock
  app.post('/secondary/:id/restock', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      delta: z.number().int().min(1),
      notes: z.string().optional(),
    });

    const body = schema.parse(req.body);

    const updated = await withTenant(req.user!.storeId, async (tx) => {
      const item = await tx.secondaryItem.findUnique({ where: { id } });
      if (!item) throw new Error('Acessório/Item não encontrado.');

      const newQty = item.stockQty + body.delta;
      const updatedItem = await tx.secondaryItem.update({
        where: { id },
        data: { stockQty: newQty },
      });

      await tx.stockLedger.create({
        data: {
          storeId: req.user!.storeId,
          itemType: 'Acessório',
          itemId: id,
          itemLabel: item.name,
          sku: item.sku,
          delta: body.delta,
          resultingStock: newQty,
          reason: 'Reposição',
          note: body.notes,
          actorUserId: req.user!.userId,
          actorName: req.user!.name,
        },
      });

      await tx.auditLog.create({
        data: {
          storeId: req.user!.storeId,
          actorUserId: req.user!.userId,
          actorName: req.user!.name,
          actorRole: req.user!.role,
          action: 'RESTOCK',
          entityType: 'ACCESSORY',
          entityId: id,
          targetLabel: item.name,
          detail: `Reposição de +${body.delta} unidades de ${item.name}. Novo estoque: ${newQty}`,
        },
      });

      return updatedItem;
    });

    return reply.send(sanitizeSecondaryItem(updated, req.user!.role === 'ADMIN'));
  });

  // GET /api/inventory/models
  app.get('/models', async (req, reply) => {
    const models = await withTenant(req.user!.storeId, async (tx) => {
      return await tx.deviceModel.findMany({
        where: { storeId: req.user!.storeId },
        orderBy: { modelName: 'asc' },
      });
    });

    return reply.send(models);
  });
}
