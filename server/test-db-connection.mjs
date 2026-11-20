import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database...');
  const stores = await prisma.store.findMany({
    select: { id: true, name: true, slug: true, segment: true },
  });
  console.log(`Found ${stores.length} stores in Supabase DB:`);
  for (const s of stores) {
    const itemCount = await prisma.primaryItem.count({ where: { storeId: s.id } });
    const memberCount = await prisma.storeMembership.count({ where: { storeId: s.id } });
    console.log(`- Store: ${s.name} (${s.slug}) | Segment: ${s.segment} | Items: ${itemCount} | Members: ${memberCount}`);
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
  });
  console.log(`Found ${users.length} users in DB:`);
  for (const u of users) {
    console.log(`- User: ${u.name} <${u.email}>`);
  }
}

main()
  .catch((e) => {
    console.error('Database connection failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
