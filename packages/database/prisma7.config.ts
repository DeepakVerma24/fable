import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 reads this file. The URL is required by the CLI even for generate.
 * Runtime traffic from the API uses DATABASE_URL (PgBouncer).
 * Migrations should be pointed at DIRECT_DATABASE_URL (Postgres itself).
 */
const fallback = 'postgresql://fable:fable@127.0.0.1:54329/fable?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? fallback,
  },
});
