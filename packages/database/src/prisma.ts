import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client';

export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export async function pingDatabase(connectionString: string): Promise<void> {
  const client = createPrismaClient(connectionString);
  try {
    await client.$queryRawUnsafe('SELECT 1');
  } finally {
    await client.$disconnect();
  }
}
