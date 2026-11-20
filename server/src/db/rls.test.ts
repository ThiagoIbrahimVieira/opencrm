import { describe, it, expect, vi } from 'vitest';
import { withTenant, prisma } from './prisma.js';

describe('Supabase PostgreSQL 16 RLS & Tenant Isolation (Tony Stark & Reed Richards)', () => {
  const STORE_A = '11111111-1111-1111-1111-111111111111';
  const STORE_B = '22222222-2222-2222-2222-222222222222';

  it('should reject execution when storeId is not provided', async () => {
    await expect(
      withTenant('', async () => {
        return true;
      })
    ).rejects.toThrow('storeId é obrigatório');
  });

  it('should execute transaction binding SET LOCAL ROLE opencrm_app and app.current_store_id', async () => {
    const executedRawQueries: string[] = [];

    const mockTx = {
      $executeRawUnsafe: vi.fn().mockImplementation(async (query: string) => {
        executedRawQueries.push(query);
        return 1;
      }),
      $executeRaw: vi.fn().mockImplementation(async (strings: TemplateStringsArray, ...values: any[]) => {
        executedRawQueries.push(strings.join('?'));
        return 1;
      }),
      primaryItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      return await cb(mockTx);
    });

    const result = await withTenant(STORE_A, async (tx) => {
      return await tx.primaryItem.findMany({ where: { storeId: STORE_A } });
    });

    expect(result).toEqual([]);
    expect(mockTx.$executeRawUnsafe).toHaveBeenCalledWith('SET LOCAL ROLE opencrm_app;');
    expect(mockTx.$executeRaw).toHaveBeenCalled();
  });

  it('should strictly isolate Store A queries from Store B scope', async () => {
    const mockTx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      $executeRaw: vi.fn().mockResolvedValue(1),
      order: {
        findMany: vi.fn().mockImplementation(async ({ where }: any) => {
          if (where.storeId === STORE_A) {
            return [{ id: 'order-a-1', storeId: STORE_A }];
          }
          return [];
        }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      return await cb(mockTx);
    });

    const ordersA = await withTenant(STORE_A, async (tx) => {
      return await tx.order.findMany({ where: { storeId: STORE_A } });
    });

    const ordersB = await withTenant(STORE_B, async (tx) => {
      return await tx.order.findMany({ where: { storeId: STORE_B } });
    });

    expect(ordersA).toHaveLength(1);
    expect(ordersB).toHaveLength(0);
  });
});
