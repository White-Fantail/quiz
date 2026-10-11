import { db } from "./db";
import { fail, requireActor, type Actor } from "./auth";
import { topicSummaries } from "./topics";

/** Server-side filtering and pagination, scoped by immutable authorId before any search.
 * Search covers the question's revision history so an edited title remains discoverable.
 */
export async function myQuizzes(p: Record<string, any>, actor: Actor | null) {
  const owner = requireActor(actor);
  const where = {
    authorId: owner.id,
    ...(p.publication !== "all" ? { publication: p.publication } : {}),
    ...(p.safety !== "all" ? { safetyStatus: p.safety } : {}),
    ...(p.search ? { revisions: { some: { OR: [
      { title: { contains: p.search, mode: "insensitive" as const } },
      { prompt: { contains: p.search, mode: "insensitive" as const } }
    ] } } } : {})
  };
  const [quizzes, total] = await Promise.all([
    db().quiz.findMany({
      where,
      orderBy: p.sort === "oldest" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ updatedAt: "desc" }, { id: "desc" }],
      skip: p.offset, take: p.limit,
      include: {
        _count: { select: { sessions: true, reviews: true } },
        topicLinks: { include: { topic: true }, orderBy: { position: "asc" } }
      }
    }),
    db().quiz.count({ where })
  ]);
  if (!quizzes.length) return { items: [], total, count: total, offset: p.offset, limit: p.limit, hasMore: false };
  const current = await db().quizRevision.findMany({
    where: { OR: quizzes.map(q => ({ quizId: q.id, version: q.currentVersion, localization: { origin: { in:["ORIGINAL","LEGACY"] } } })) },
    select: { quizId: true, title: true, prompt: true }
  });
  const revisions = new Map(current.map(r => [r.quizId, r]));
  return {
    items: quizzes.map(q => ({
      id: q.id, title: revisions.get(q.id)?.title ?? "(제목 없음)",
      prompt: revisions.get(q.id)?.prompt ?? "",
      version: q.currentVersion, publication: q.publication, safetyStatus: q.safetyStatus,
      kidsEligible: q.kidsEligible && q.safetyStatus === "APPROVED",
      answerType: q.answerType, topics: topicSummaries(q.topicLinks, true),
      plays: q._count.sessions, reviews: q._count.reviews,
      createdAt: q.createdAt, updatedAt: q.updatedAt
    })),
    total, count: total, offset: p.offset, limit: p.limit,
    hasMore: p.offset + quizzes.length < total
  };
}

/** Do not expose player identities or free-text abuse reports to quiz authors.
 * Counts and review comments are only available after owner authentication.
 */
export async function myQuizInsights(p: Record<string, any>, actor: Actor | null) {
  const owner = requireActor(actor);
  const quiz = await db().quiz.findFirst({ where: { id: p.quizId, authorId: owner.id }, select: { id: true, currentVersion: true } });
  if (!quiz) fail(404, "not_found", "Quiz not found");
  const where = { quizId: quiz.id };
  const now=Date.now(),lastWeek=new Date(now-7*86400000),previousWeek=new Date(now-14*86400000);
  const [states, clues, average, ratings, reviewCount, feedback, reasons, recent, prior] = await Promise.all([
    db().playSession.groupBy({ by: ["status"], where, _count: { _all: true } }),
    db().playSession.groupBy({ by: ["usedClues"], where: { ...where, status: "SOLVED" },
      _count: { _all: true }, orderBy: { usedClues: "asc" } }),
    db().playSession.aggregate({ where: { ...where, status: { in: ["SOLVED", "FAILED"] } },
      _avg: { usedClues: true } }),
    db().review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
    db().review.count({ where }),
    db().review.findMany({ where, select: { id: true, rating: true, comment: true, createdAt: true,
      author: { select: { displayName: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: p.offset, take: p.limit }),
    db().report.groupBy({ by: ["reason"], where, _count: { _all: true } }),
    db().review.groupBy({by:["rating"],where:{...where,updatedAt:{gte:lastWeek}},_count:{_all:true}}),
    db().review.groupBy({by:["rating"],where:{...where,updatedAt:{gte:previousWeek,lt:lastWeek}},_count:{_all:true}})
  ]);
  const statusCount = (status: string) => states.find(s => s.status === status)?._count._all ?? 0;
  const started = states.reduce((sum, s) => sum + s._count._all, 0);
  const solved = statusCount("SOLVED");
  const failed = statusCount("FAILED");
  const completed = solved + failed;
  return {
    quizId: quiz.id, currentVersion: quiz.currentVersion, scope: "ALL_REVISIONS",
    started, completed, solved, failed, inProgressOrAbandoned: started - completed,
    completionRate: started ? completed / started : null,
    successRate: completed ? solved / completed : null,
    averageCluesUsed: average._avg.usedClues,
    correctByClueStage: clues.map(c => ({ stage: c.usedClues, correct: c._count._all })),
    reviews: {
      positive: ratings.find(r => r.rating === 1)?._count._all ?? 0,
      negative: ratings.find(r => r.rating === -1)?._count._all ?? 0,
      total: reviewCount, items: feedback, offset: p.offset, limit: p.limit,
      trend:{last7Days:{positive:recent.find(r=>r.rating===1)?._count._all??0,negative:recent.find(r=>r.rating===-1)?._count._all??0},
        previous7Days:{positive:prior.find(r=>r.rating===1)?._count._all??0,negative:prior.find(r=>r.rating===-1)?._count._all??0}},
      hasMore: p.offset + feedback.length < reviewCount
    },
    reports: { total: reasons.reduce((sum, r) => sum + r._count._all, 0),
      byReason: reasons.map(r => ({ reason: r.reason, count: r._count._all })) },
    note: "All question versions are combined. Success rate counts solved / finished, excluding unfinished sessions; reports are aggregated without user details."
  };
}
