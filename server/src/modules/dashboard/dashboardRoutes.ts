import { FastifyInstance } from 'fastify';
import { withTenant } from '../../db/prisma.js';
import { authenticateToken } from '../../middlewares/authMiddleware.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateToken);

  // GET /api/dashboard/summary
  app.get('/summary', async (req, reply) => {
    const summary = await withTenant(req.user!.storeId, async (tx) => {
      const storeId = req.user!.storeId;

      const [
        availSmartphones,
        resSmartphones,
        evalSmartphones,
        lowStockAcc,
        allAccessories,
        orders,
        activeCustomers,
        leadCustomers,
        inactiveCustomers,
      ] = await Promise.all([
        tx.primaryItem.count({ where: { storeId, status: 'DISPONIVEL' } }),
        tx.primaryItem.count({ where: { storeId, status: 'RESERVADO' } }),
        tx.primaryItem.count({ where: { storeId, status: 'EM_AVALIACAO' } }),
        tx.secondaryItem.count({ where: { storeId, stockQty: { lte: 5 } } }),
        tx.secondaryItem.findMany({ where: { storeId }, select: { stockQty: true } }),
        tx.order.findMany({
          where: { storeId },
          select: { totalCents: true, warrantyExpiresAt: true, createdAt: true },
        }),
        tx.customer.count({ where: { storeId, status: 'ATIVO' } }),
        tx.customer.count({ where: { storeId, status: 'LEAD' } }),
        tx.customer.count({ where: { storeId, status: 'INATIVO' } }),
      ]);

      const totalAccessoryUnits = allAccessories.reduce((acc: number, curr: any) => acc + (curr.stockQty || 0), 0);
      const totalRevenueCents = orders.reduce((acc: number, curr: any) => acc + (curr.totalCents || 0), 0);

      const now = new Date();
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const activeWarranties = orders.filter((o) => o.warrantyExpiresAt && o.warrantyExpiresAt > now).length;
      const expiringWarrantiesCount = orders.filter(
        (o) => o.warrantyExpiresAt && o.warrantyExpiresAt > now && o.warrantyExpiresAt <= in30Days
      ).length;

      return {
        availableSmartphones: availSmartphones,
        reservedSmartphones: resSmartphones,
        evaluatingSmartphones: evalSmartphones,
        lowStockAccessories: lowStockAcc,
        totalAccessoryUnits,
        activeWarranties,
        expiringWarrantiesCount,
        expiringBatchesCount: 0,
        weeklyOutputs: orders.length,
        weeklyRevenue: totalRevenueCents / 100,
        customerCounts: {
          total: activeCustomers + leadCustomers + inactiveCustomers,
          active: activeCustomers,
          lead: leadCustomers,
          inactive: inactiveCustomers,
        },
      };
    });

    return reply.send(summary);
  });
}
