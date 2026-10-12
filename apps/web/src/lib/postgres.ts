import { Pool } from "pg";

/**
 * One pg pool per warm Vercel instance, shared by Prisma and Better Auth.
 *
 * Keep the per-instance limit small: Vercel can run many instances, and
 * without a pooled DATABASE_URL they would exhaust direct DB connections.
 */
const holder = globalThis as unknown as { quizdipSharedPool?: Pool };

export function databasePool(): Pool {
  holder.quizdipSharedPool ??= new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/quizdip",
    max: 2,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
  });
  return holder.quizdipSharedPool;
}
