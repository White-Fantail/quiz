import { db } from "./db";
import { fail, requireActor, type Actor } from "./auth";

export async function quizStats(p: Record<string, any>, actor: Actor | null) {
  const quiz = await db().quiz.findUnique({ where: { id: p.quizId } });
  if (!quiz || (quiz.authorId !== actor?.id &&
      (quiz.publication !== "PUBLISHED" || quiz.safetyStatus === "RESTRICTED")))
    fail(404, "not_found", "Quiz not found");
  const version = p.version ?? quiz.currentVersion;
  const revision = await db().quizRevision.findFirst({ where: { quizId: quiz.id, version, localization: { origin: {in:["ORIGINAL","LEGACY"]} } } });
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
  return { id: user.id, displayName: user.displayName, leaderboardEligible: user.leaderboardEligible, leaderboardOptIn: user.leaderboardOptIn,
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
    where: { id: { in: ids }, leaderboardEligible: true, leaderboardOptIn: true },
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
    user.leaderboardEligible && user.leaderboardOptIn ? leaderboard({ limit: 100000, offset: 0 }) : Promise.resolve(null)
  ]);
  const totalBestScore = best.reduce((sum, row) => sum + (row._max.score ?? 0), 0);
  return { started, finished: solved + failed, solved, failed, successRate: solved + failed ? solved / (solved + failed) : null,
    distinctSolved: best.length, totalBestScore,
    rank: standings ? standings.items.find(item => item.userId === user.id)?.rank ?? null : null,
    leaderboardEligible: user.leaderboardEligible };
}

/** User consent controls public ranking visibility, not adult verification. */
export async function rankingOptin(p: Record<string,any>, actor: Actor|null) {
  const user=requireActor(actor);
  await db().user.update({where:{id:user.id},data:{leaderboardOptIn:p.enabled}});
  await db().auditLog.create({data:{actorId:user.id,action:"ranking.consent",objectId:user.id,
    detail:{enabled:p.enabled}}});
  return {leaderboardOptIn:p.enabled,leaderboardEligible:user.leaderboardEligible,
    visibleInPublicRankings:p.enabled&&user.leaderboardEligible};
}
/** Trusted staff verification only. Users can never self-attest adult eligibility. */
export async function adultVerify(p: Record<string,any>,actor: Actor|null) {
  const admin=requireActor(actor);
  if(admin.role!=="ADMIN") fail(403,"admin_required","Trusted adult verification requires admin authority");
  const subject=await db().user.findUnique({where:{id:p.userId}});
  if(!subject) fail(404,"not_found","Account not found");
  await db().$transaction(async tx=>{
    await tx.user.update({where:{id:subject.id},data:{leaderboardEligible:p.verified}});
    await tx.auditLog.create({data:{actorId:admin.id,action:"ranking.adult_verification",objectId:subject.id,
      detail:{verified:p.verified,reason:p.reason}}});
  });
  return {userId:subject.id,adultVerified:p.verified,rankingOptIn:subject.leaderboardOptIn};
}
