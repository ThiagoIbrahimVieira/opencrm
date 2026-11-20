import { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';

export async function publicRoutes(app: FastifyInstance) {
  // GET /api/public/warranty/:publicToken
  // Endpoint público via QR Code (Zero autenticação, Rate Limited, Whitelist estrita LGPD)
  app.get('/warranty/:publicToken', async (req, reply) => {
    const { publicToken } = req.params as { publicToken: string };

    const order = await prisma.order.findUnique({
      where: { publicWarrantyToken: publicToken },
      include: {
        store: true,
        orderItems: {
          include: {
            primaryItem: true,
            secondaryItem: true,
          },
        },
      },
    });

    if (!order) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Termo de garantia não localizado para este QR Code.',
      });
    }

    const primaryOrderItem = order.orderItems.find((oi) => oi.primaryItemId);
    const primaryItem = primaryOrderItem?.primaryItem;

    const issuedAt = order.createdAt.toISOString().slice(0, 10);
    const expiresAt = order.warrantyExpiresAt ? order.warrantyExpiresAt.toISOString().slice(0, 10) : '';

    const now = new Date();
    const expDate = order.warrantyExpiresAt || now;
    const daysRemaining = Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const percentRemaining =
      order.warrantyDays > 0 ? Math.min(100, Math.round((daysRemaining / order.warrantyDays) * 100)) : 0;

    // WHITELIST ESTRITA LGPD: Nunca expõe CPF, Telefone, E-mail, Custo ou Margem!
    const publicWarrantyData = {
      publicToken: order.publicWarrantyToken,
      orderCode: order.orderCode,
      storeName: order.store.name,
      deviceBrand: primaryItem?.title || 'Produto Principal',
      deviceModel: primaryItem?.title || 'Produto Principal',
      deviceStorage: primaryItem?.storageGb || '',
      deviceColor: primaryItem?.color || '',
      deviceCondition: primaryItem?.condition || '',
      imeiLast4: primaryItem?.imei1 ? primaryItem.imei1.slice(-4) : '',
      issuedAt,
      warrantyExpiresAt: expiresAt,
      warrantyDays: order.warrantyDays,
      daysRemaining,
      percentRemaining,
      checklist: (primaryItem?.checklistJson as any) || [],
      accessoriesSummary: order.orderItems
        .filter((oi) => oi.secondaryItemId)
        .map((oi) => oi.itemTitle),
    };

    return reply.send(publicWarrantyData);
  });
}
