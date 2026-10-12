import { Pool } from "pg";

/**
 * One pg pool per warm Vercel instance, shared by Prisma and Better Auth.
 *
 * Keep the per-instance limit small: Vercel can run many instances, and
 * without a pooled DATABASE_URL they would exhaust direct DB connections.
 */
const holder = globalThis as unknown as { quizdipSharedPool?: Pool };

export function databasePool(): Pool {
  if (!holder.quizdipSharedPool) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/quizdip",
      max: 2,
      // Allow slower TLS/remote DB handshakes without increasing DB capacity.
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 10_000,
    });

    // pg-pool emits an 'error' when an idle client disconnects. Without a
    // listener EventEmitter can crash a warm function process. The pool has
    // already evicted the client and reconnects when another query arrives.
    pool.on("error", (error) => {
      console.error("[database] Idle PostgreSQL connection lost", {
        code: (error as Error & { code?: string }).code || "UNKNOWN",
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      });
    });

    holder.quizdipSharedPool = pool;
  }
  return holder.quizdipSharedPool;
}
