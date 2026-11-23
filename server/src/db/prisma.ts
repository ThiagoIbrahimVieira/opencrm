import { PrismaClient, Prisma } from '@prisma/client';
import { env } from '../config/env.js';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/**
 * Executes a callback within a transactional multi-tenant context.
 * Injects `SET LOCAL ROLE opencrm_app;` and sets `app.current_store_id`.
 * Compatible with Supabase Transaction Pooler (port 6543) and enforces real RLS at DB level.
 */
export async function withTenant<T>(
  storeId: string | null | undefined,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (!storeId) {
    throw new Error('storeId é obrigatório para execução dentro de withTenant.');
  }

  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Switch connection role to restricted opencrm_app role
    await tx.$executeRawUnsafe(`SET LOCAL ROLE opencrm_app;`);
    // Bind session store_id for RLS policies
    await tx.$executeRaw`SELECT set_config('app.current_store_id', ${storeId}, true);`;
    return await fn(tx);
  });
}
