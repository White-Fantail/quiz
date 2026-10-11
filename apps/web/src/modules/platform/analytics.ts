import { db } from "./db";
import { fail, requireActor, type Actor } from "./auth";

export async function quizStats(p: Record<string, any>, actor: Actor | null) {
  const quiz = await db().quiz.findUnique({ where: { id: p.quizId } });
  if (!quiz || (quiz.authorId !== actor?.id &&
      (quiz.publication !== "PUBLISHED" || quiz.safetyStatus === "RESTRICTED")))
    fail(404, "not_found", "Quiz not found");
  const version = p.version ?? quiz.currentVersion;
  const revision = await db().quizRevision.findUnique({ where: { quizId_version: { quizId: quiz.id, version } } });
  if (!revision) fail(404, "not_found", "Quiz version not found");
  const where = { quizId: quiz.id, revisionId: revision.id };
  const [started, solved, failed, stage, used, positive, negative] = await Promise.all([
    db().playSession.count({ where }), db().playSession.count({ where: { ...where, status: "SOLVED" } }),
    db().playSession.count({ where: { ...where, status: "FAILED" } }),
    db().playSession.groupBy({ by: ["usedClues"], where: { ...where, status: "SOLVED" }, _count: { _all: true }, orderBy: { usedClues: "asc" } }),
    db().playSession.aggregate({ where: { ...where, status: { in: ["SOLVED", "FAILED"] } }, _avg: { usedClues: true } }),
    db().review.count({ where: { quizId: quiz.id, rating: 1 } }),
    db().review.count({ where: { quizId: quiz.id, rating: -1 } })
  ]);
  return { quizId: quiz.id, version, isCurrentVersion: version === quiz.currentVersion,
    started, completed: solved + failed, solved, failed,
    successRate: solved + failed ? solved / (solved + failed) : null,
    completionRate: started ? (solved + failed) / started : null,
    averageCluesUsed: used._avg.usedClues,
    correctByClueStage: stage.map(s => ({ stage: s.usedClues, correct: s._count._all })),
    reviews: { positive, negative },
    note: "Success rate is solved / finished; in-progress and abandoned plays are excluded." };
}
export async function me(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  return { id: user.id, displayName: user.displayName, leaderboardEligible: user.leaderboardEligible,
    note: "Leaderboard requires separately verified adult eligibility; default is opt-out." };
}
export async function leaderboard(p: Record<string, any>) {
  // One best score per question per eligible verified adult, to reduce replay farming.
  const best = await db().playSession.groupBy({
    by: ["userId", "quizId"],
    where: { status: "SOLVED", userId: { not: null }, ...(p.quizId ? { quizId: p.quizId } : {}) },
    _max: { score: true }
  });
  const ids = [...new Set(best.map(b => b.userId).filter((id): id is string => id !== null))];
  if (!ids.length) return { items: [], total: 0 };
  const users = await db().user.findMany({
    where: { id: { in: ids }, leaderboardEligible: true },
    select: { id: true, displayName: true }
  });
  const eligible = new Map(users.map(u => [u.id, u]));
  const standings = new Map<string, { userId: string; displayName: string; score: number; quizzesSolved: number }>();
  for (const row of best) {
    const u = row.userId ? eligible.get(row.userId) : null;
    if (!u) continue;
    const previous = standings.get(u.id) || { userId: u.id, displayName: u.displayName, score: 0, quizzesSolved: 0 };
    previous.score += row._max.score ?? 0;
    previous.quizzesSolved++;
    standings.set(u.id, previous);
  }
  const all = [...standings.values()].sort((a, b) =>
    b.score - a.score || b.quizzesSolved - a.quizzesSolved || a.userId.localeCompare(b.userId));
  return { items: all.slice(p.offset, p.offset + p.limit).map((entry, idx) => ({
    rank: p.offset + idx + 1, ...entry
  })), total: all.length, rankingBasis: "best score per quiz, verified adult opt-in only" };
}
export async function myStats(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  const [started, solved, failed, best, standings] = await Promise.all([
    db().playSession.count({ where: { userId: user.id } }),
    db().playSession.count({ where: { userId: user.id, status: "SOLVED" } }),
    db().playSession.count({ where: { userId: user.id, status: "FAILED" } }),
    db().playSession.groupBy({ by: ["quizId"], where: { userId: user.id, status: "SOLVED" }, _max: { score: true } }),
    user.leaderboardEligible ? leaderboard({ limit: 100000, offset: 0 }) : Promise.resolve(null)
  ]);
  const totalBestScore = best.reduce((sum, row) => sum + (row._max.score ?? 0), 0);
  return { started, finished: solved + failed, solved, failed, successRate: solved + failed ? solved / (solved + failed) : null,
    distinctSolved: best.length, totalBestScore,
    rank: standings ? standings.items.find(item => item.userId === user.id)?.rank ?? null : null,
    leaderboardEligible: user.leaderboardEligible };
}
