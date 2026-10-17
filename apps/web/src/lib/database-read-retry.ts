/**
 * Retry a single read-only operation after a transient PostgreSQL TCP failure.
 * Never wrap writes or transactions here: their outcome may be unknown after
 * a connection reset, and repeating them could produce duplicate effects.
 */
const TRANSIENT_CONNECTION_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT",
  "EHOSTUNREACH", "ENETUNREACH",
  "08000", "08003", "08006", "57P01", "57P02", "57P03",
]);

type ErrorWithCauses = {
  code?: unknown;
  cause?: unknown;
  originalError?: unknown;
  driverAdapterError?: unknown;
  meta?: unknown;
};

export function transientDatabaseConnectionCode(error: unknown): string | null {
  const visited = new Set<unknown>();
  const pending: unknown[] = [error];
  while (pending.length) {
    const item = pending.pop();
    if (item === null || typeof item !== "object" || visited.has(item)) continue;
    visited.add(item);
    const candidate = item as ErrorWithCauses;
    const code = candidate.code;
    if (typeof code === "string" && TRANSIENT_CONNECTION_CODES.has(code)) return code;
    pending.push(candidate.cause, candidate.originalError, candidate.driverAdapterError, candidate.meta);
  }
  return null;
}

export async function retryTransientDatabaseRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    const code = transientDatabaseConnectionCode(error);
    if (!code) throw error;

    // pg-pool removes disconnected clients, so the next read acquires a new
    // connection. Retry once only; do not turn a persistent outage into a loop.
    console.warn("[database] Retrying read after transient connection failure", { code });
    await new Promise<void>((resolve) => setTimeout(resolve, 125));
    return read();
  }
}
