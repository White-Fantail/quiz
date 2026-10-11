export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** All weekly editions use exactly the same Monday 00:00 UTC boundary worldwide. */
export function utcWeekStart(now = new Date()): Date {
  const day = now.getUTCDay();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((day + 6) % 7));
  return start;
}

/** Competition ranks: all players on the same score share the same place. */
export function scoreRanks<T extends { score: number }>(sorted: T[]): Array<T & { rank: number }> {
  let lastScore: number | null = null, rank = 0;
  return sorted.map((row, index) => {
    if (row.score !== lastScore) {
      lastScore = row.score;
      rank = index + 1;
    }
    return { ...row, rank };
  });
}
