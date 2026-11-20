import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import { withTenant, prisma } from '../../db/prisma.js';
import { authenticateToken } from '../../middlewares/authMiddleware.js';

export async function orderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateToken);

  // GET /api/orders
  app.get('/', async (req, reply) => {
    const orders = await withTenant(req.user!.storeId, async (tx) => {
      return await tx.order.findMany({
        where: { storeId: req.user!.storeId },
        include: {
          customer: true,
          orderItems: {
            include: { primaryItem: true, secondaryItem: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    const formatted = orders.map((o) => ({
      id: o.id,
      code: o.orderCode,
      publicToken: o.publicWarrantyToken,
      customerId: o.customerId,
      customerName: o.customer.fullName,
      totalAmount: o.totalCents / 100,
      paymentMethod: o.paymentMethod,
      warrantyDays: o.warrantyDays,
      issuedAt: o.createdAt.toISOString().slice(0, 10),
      warrantyExpiresAt: o.warrantyExpiresAt ? o.warrantyExpiresAt.toISOString().slice(0, 10) : '',
      sellerName: o.sellerName || '',
      accessories: o.orderItems
        .filter((oi) => oi.secondaryItemId)
        .map((oi) => ({
          accessoryId: oi.secondaryItemId!,
          sku: oi.secondaryItem?.sku || '',
          name: oi.itemTitle,
          quantity: oi.quantity,
          unitPrice: oi.unitPriceCents / 100,
        })),
      smartphoneSnapshot: o.orderItems.find((oi) => oi.primaryItemId)?.primaryItem
        ? {
            title: o.orderItems.find((oi) => oi.primaryItemId)!.primaryItem!.title,
            brand: o.orderItems.find((oi) => oi.primaryItemId)!.primaryItem!.title,
            model: o.orderItems.find((oi) => oi.primaryItemId)!.primaryItem!.title,
            storage: o.orderItems.find((oi) => oi.primaryItemId)!.primaryItem!.storageGb || '',
            color: o.orderItems.find((oi) => oi.primaryItemId)!.primaryItem!.color || '',
            condition: o.orderItems.find((oi) => oi.primaryItemId)!.primaryItem!.condition || '',
            batteryHealth: o.orderItems.find((oi) => oi.primaryItemId)!.primaryItem!.batteryHealth || 100,
            imei1: o.orderItems.find((oi) => oi.primaryItemId)!.primaryItem!.imei1 || '',
            serialNumber: o.orderItems.find((oi) => oi.primaryItemId)!.primaryItem!.serialNumber || '',
            checklist: o.orderItems.find((oi) => oi.primaryItemId)!.primaryItem!.checklistJson || [],
            unitPrice: o.orderItems.find((oi) => oi.primaryItemId)!.unitPriceCents / 100,
          }
        : undefined,
    }));

    return reply.send(formatted);
  });

  // POST /api/orders (ACID Checkout Transacional + Idempotency-Key + Anti-Race Condition 409)
  app.post('/', async (req, reply) => {
    const rawIdempotency = (req.headers['idempotency-key'] as string) || (req.body as any)?.idempotencyKey;
    const idempotencyKey = rawIdempotency || crypto.randomUUID();

    const schema = z.object({
      customerId: z.string().uuid(),
      primaryItemId: z.string().uuid().optional().nullable(),
      accessoryItems: z
        .array(
          z.object({
            accessoryId: z.string().uuid(),
            quantity: z.number().int().min(1),
          })
        )
        .default([]),
      warrantyDays: z.number().int().default(90),
      paymentMethod: z.string().min(1),
      sellerName: z.string().optional(),
    });

    const body = schema.parse(req.body);

    // 1. CHECAGEM DE IDEMPOTÊNCIA: Se já foi processado na mesma loja, retorna o pedido original
    const existingOrder = await prisma.order.findUnique({
      where: {
        storeId_idempotencyKey: {
          storeId: req.user!.storeId,
          idempotencyKey,
        },
      },
      include: {
        customer: true,
        orderItems: true,
      },
    });

    if (existingOrder) {
      return reply.status(200).send({
        id: existingOrder.id,
        code: existingOrder.orderCode,
        publicToken: existingOrder.publicWarrantyToken,
        customerId: existingOrder.customerId,
        totalAmount: existingOrder.totalCents / 100,
        paymentMethod: existingOrder.paymentMethod,
        warrantyDays: existingOrder.warrantyDays,
        idempotentReplay: true,
      });
    }

    try {
      const order = await withTenant(req.user!.storeId, async (tx) => {
        // Validação do Cliente no Tenant
        const customer = await tx.customer.findUnique({
          where: { id: body.customerId },
        });
        if (!customer) {
          throw new Error('NOT_FOUND_CUSTOMER');
        }

        let totalCents = 0;
        let primaryItemRecord: any = null;

        // 2. BAIXA TRANSACIONAL ATÔMICA DO ITEM PRINCIPAL
        if (body.primaryItemId) {
          const item = await tx.primaryItem.findUnique({
            where: { id: body.primaryItemId },
          });

          if (!item) {
            throw new Error('NOT_FOUND_PRIMARY');
          }

          if (item.isSerialized) {
            // Se serializado: Atualiza status para VENDIDO apenas se estiver DISPONIVEL/RESERVADO
            const updateRes = await tx.primaryItem.updateMany({
              where: {
                id: body.primaryItemId,
                storeId: req.user!.storeId,
                status: { in: ['DISPONIVEL', 'RESERVADO'] },
              },
              data: {
                status: 'VENDIDO',
                stockQty: 0,
              },
            });

            if (updateRes.count === 0) {
              throw new Error('CONFLICT_PRIMARY_ALREADY_SOLD');
            }
          } else {
            // Se por quantidade: Baixa atômica garantindo que stockQty >= 1
            const updateRes = await tx.primaryItem.updateMany({
              where: {
                id: body.primaryItemId,
                storeId: req.user!.storeId,
                stockQty: { gte: 1 },
              },
              data: {
                stockQty: { decrement: 1 },
                status: item.stockQty - 1 <= 0 ? 'ESGOTADO' : 'DISPONIVEL',
              },
            });

            if (updateRes.count === 0) {
              throw new Error('CONFLICT_PRIMARY_OUT_OF_STOCK');
            }
          }

          totalCents += item.salePriceCents;
          primaryItemRecord = item;
        }

        // 3. BAIXA TRANSACIONAL DOS ITENS SECUNDÁRIOS / ACESSÓRIOS
        const secondaryItemsRecords: { item: any; quantity: number }[] = [];
        for (const acc of body.accessoryItems) {
          const secItem = await tx.secondaryItem.findUnique({
            where: { id: acc.accessoryId },
          });

          if (!secItem) {
            throw new Error('NOT_FOUND_ACCESSORY');
          }

          const updateSecRes = await tx.secondaryItem.updateMany({
            where: {
              id: acc.accessoryId,
              storeId: req.user!.storeId,
              stockQty: { gte: acc.quantity },
            },
            data: {
              stockQty: { decrement: acc.quantity },
            },
          });

          if (updateSecRes.count === 0) {
            throw new Error(`CONFLICT_ACCESSORY_OUT_OF_STOCK_${secItem.name}`);
          }

          totalCents += secItem.salePriceCents * acc.quantity;
          secondaryItemsRecords.push({ item: secItem, quantity: acc.quantity });
        }

        // Geração do código do pedido
        const orderCount = await tx.order.count({ where: { storeId: req.user!.storeId } });
        const store = await tx.store.findUnique({ where: { id: req.user!.storeId } });
        const prefix = (store?.name || 'OC').slice(0, 2).toUpperCase();
        const year = new Date().getFullYear();
        const code = `${prefix}-${year}-${String(orderCount + 1).padStart(4, '0')}`;

        const warrantyDays = body.warrantyDays;
        const warrantyExpiresAt = new Date(Date.now() + warrantyDays * 24 * 60 * 60 * 1000);

        // Snapshot dos termos de garantia
        const warrantySnapshot = {
          orderCode: code,
          warrantyDays,
          expiresAt: warrantyExpiresAt.toISOString(),
          customerName: customer.fullName,
          primaryItemTitle: primaryItemRecord?.title,
          imeiLast4: primaryItemRecord?.imei1 ? primaryItemRecord.imei1.slice(-4) : undefined,
          checklist: primaryItemRecord?.checklistJson || [],
        };

        // 4. CRIAÇÃO DO PEDIDO
        const newOrder = await tx.order.create({
          data: {
            storeId: req.user!.storeId,
            orderCode: code,
            customerId: body.customerId,
            sellerId: req.user!.userId,
            sellerName: body.sellerName || req.user!.name,
            paymentMethod: body.paymentMethod,
            warrantyDays,
            warrantyExpiresAt,
            warrantyTermsSnapshot: warrantySnapshot,
            idempotencyKey,
            totalCents,
          },
        });

        // 5. CRIAÇÃO DOS ITENS DO PEDIDO E STOCK LEDGER
        if (primaryItemRecord) {
          await tx.orderItem.create({
            data: {
              storeId: req.user!.storeId,
              orderId: newOrder.id,
              primaryItemId: primaryItemRecord.id,
              itemTitle: primaryItemRecord.title,
              quantity: 1,
              unitPriceCents: primaryItemRecord.salePriceCents,
            },
          });

          await tx.stockLedger.create({
            data: {
              storeId: req.user!.storeId,
              itemType: 'Aparelho',
              itemId: primaryItemRecord.id,
              itemLabel: primaryItemRecord.title,
              sku: primaryItemRecord.skuCode,
              delta: -1,
              resultingStock: primaryItemRecord.isSerialized ? 0 : primaryItemRecord.stockQty - 1,
              reason: 'Saída / Venda',
              note: `Venda Pedido ${code}`,
              actorUserId: req.user!.userId,
              actorName: req.user!.name,
            },
          });
        }

        for (const sec of secondaryItemsRecords) {
          await tx.orderItem.create({
            data: {
              storeId: req.user!.storeId,
              orderId: newOrder.id,
              secondaryItemId: sec.item.id,
              itemTitle: sec.item.name,
              quantity: sec.quantity,
              unitPriceCents: sec.item.salePriceCents,
            },
          });

          await tx.stockLedger.create({
            data: {
              storeId: req.user!.storeId,
              itemType: 'Acessório',
              itemId: sec.item.id,
              itemLabel: sec.item.name,
              sku: sec.item.sku,
              delta: -sec.quantity,
              resultingStock: sec.item.stockQty - sec.quantity,
              reason: 'Saída / Venda',
              note: `Venda Pedido ${code}`,
              actorUserId: req.user!.userId,
              actorName: req.user!.name,
            },
          });
        }

        // 6. REGISTRO IMUTÁVEL DE AUDITORIA
        await tx.auditLog.create({
          data: {
            storeId: req.user!.storeId,
            actorUserId: req.user!.userId,
            actorName: req.user!.name,
            actorRole: req.user!.role,
            action: 'CREATE_ORDER',
            entityType: 'ORDER',
            entityId: newOrder.id,
            targetLabel: code,
            detail: `Venda finalizada: Pedido ${code} para ${customer.fullName} no valor de R$ ${(totalCents / 100).toFixed(2)}`,
          },
        });

        return newOrder;
      });

      return reply.status(201).send({
        id: order.id,
        code: order.orderCode,
        publicToken: order.publicWarrantyToken,
        customerId: order.customerId,
        totalAmount: order.totalCents / 100,
        paymentMethod: order.paymentMethod,
        warrantyDays: order.warrantyDays,
        issuedAt: order.createdAt.toISOString().slice(0, 10),
      });
    } catch (err: any) {
      if (err.message && err.message.startsWith('CONFLICT_')) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message:
            'Conflito de concorrência: o item selecionado já foi vendido ou estoque insuficiente no momento.',
          detail: err.message,
        });
      }

      if (err.message && err.message.startsWith('NOT_FOUND_')) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Item ou cliente não encontrado nesta loja.',
        });
      }

      throw err;
    }
  });
}
