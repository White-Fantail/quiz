/** Bounded serialization-conflict retry for a single database write transaction.
 * Retry the WHOLE transaction after a short jittered delay; never retry an individual write.
 */
export const RUN_SYNC_MAX_ATTEMPTS = 5;

export class RunSyncBusyError extends Error {
  readonly code = "run_sync_busy";
  readonly lastConflictCode: "P2034" | "P2002";
  constructor(lastConflictCode: "P2034" | "P2002") {
    super("Run result sync remained busy after retrying transactions");
    this.name = "RunSyncBusyError";
    this.lastConflictCode = lastConflictCode;
  }
}

export function isRetryableSyncConflict(error: unknown): error is { code: "P2034" | "P2002" } {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "P2034" || code === "P2002";
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function withSerializableWriteRetry<T>(
  work: () => Promise<T>,
  options: {
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
    onRetry?: (code: "P2034" | "P2002", attempt: number, waitMs: number) => void;
  } = {}
): Promise<T> {
  for (let index = 0; index < RUN_SYNC_MAX_ATTEMPTS; index++) {
    try {
      return await work();
    } catch (error) {
      if (!isRetryableSyncConflict(error)) throw error;
      if (index === RUN_SYNC_MAX_ATTEMPTS - 1) throw new RunSyncBusyError(error.code);
      const waitMs = 50 * 2 ** index + Math.floor((options.random ?? Math.random)() * 25);
      options.onRetry?.(error.code, index + 1, waitMs);
      await (options.sleep ?? defaultSleep)(waitMs);
    }
  }
  throw new Error("Unreachable run sync retry state");
}
