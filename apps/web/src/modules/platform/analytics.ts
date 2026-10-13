import { db } from "./db";
import { fail, requireActor, type Actor } from "./auth";
import { publicLeaderboard, personalRankingPeriods } from "./leaderboard-service";

export async function quizStats(p:Record<string,any>,actor:Actor|null) {
  const quiz=await db().quiz.findUnique({where:{id:p.quizId}});
  if(!quiz || (quiz.authorId!==actor?.id &&
    (quiz.publication!=="PUBLISHED" || quiz.safetyStatus!=="ACTIVE")))
    fail(404,"not_found","Quiz not found");
  const loc=await db().quizLocalization.findUnique({
    where:{quizId_locale:{quizId:quiz.id,locale:p.locale}}});
  if(!loc || (quiz.authorId!==actor?.id && (loc.status!=="PUBLISHED" || loc.publishedVersion===null)))
    fail(404,"locale_unavailable","This quiz language is unavailable");
  const version=p.version??(quiz.authorId===actor?.id?loc.currentVersion:loc.publishedVersion);
  const revision=await db().quizRevision.findUnique({
    where:{localizationId_version:{localizationId:loc.id,version}}});
  if(!revision)fail(404,"not_found","Quiz language revision not found");
  const where={quizId:quiz.id,revisionId:revision.id,locale:p.locale};
  const [started,solved,failed,stage,used,positive,negative,translation]=await Promise.all([
    db().playSession.count({where}),
    db().playSession.count({where:{...where,status:"SOLVED"}}),
    db().playSession.count({where:{...where,status:"FAILED"}}),
    db().playSession.groupBy({by:["usedClues"],where:{...where,status:"SOLVED"},
      _count:{_all:true},orderBy:{usedClues:"asc"}}),
    db().playSession.aggregate({where:{...where,status:{in:["SOLVED","FAILED"]}},
      _avg:{usedClues:true}}),
    db().review.count({where:{quizId:quiz.id,locale:p.locale,kind:"QUIZ",rating:1,revisionId:revision.id}}),
    db().review.count({where:{quizId:quiz.id,locale:p.locale,kind:"QUIZ",rating:-1,revisionId:revision.id}}),
    db().review.groupBy({by:["rating"],where:{quizId:quiz.id,locale:p.locale,kind:"TRANSLATION",
      revisionId:revision.id},_count:{_all:true}})
  ]);
  return {quizId:quiz.id,locale:p.locale,version,revisionId:revision.id,
    isCurrentVersion:version===loc.currentVersion,isPublishedVersion:version===loc.publishedVersion,
    started,completed:solved+failed,solved,failed,
    completionRate:started?(solved+failed)/started:null,
    successRate:solved+failed?solved/(solved+failed):null,
    averageCluesUsed:used._avg.usedClues,
    correctByClueStage:stage.map(s=>({stage:s.usedClues,correct:s._count._all})),
    reviews:{positive,negative},
    translationReviews:{positive:translation.find(r=>r.rating===1)?._count._all??0,
      negative:translation.find(r=>r.rating===-1)?._count._all??0},
    note:"Each play is pinned to a language and immutable revision; unfinished plays are excluded from success rate."};
}
export async function me(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  return { id: user.id, displayName: user.displayName, leaderboardEligible: user.leaderboardEligible, leaderboardOptIn: user.leaderboardOptIn,
    note: "Leaderboard requires separately verified adult eligibility; default is opt-out." };
}
/** Shared public REST/MCP ranking API, verified adult opt-in only. */
export async function leaderboard(p:Record<string,any>) {
  return publicLeaderboard(p as any);
}
export async function myStats(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  const [started, solved, failed, best, standings, periodReport, weeklyStandings] = await Promise.all([
    db().playSession.count({ where: { userId: user.id } }),
    db().playSession.count({ where: { userId: user.id, status: "SOLVED" } }),
    db().playSession.count({ where: { userId: user.id, status: "FAILED" } }),
    db().playSession.groupBy({ by: ["quizId"], where: { userId: user.id, status: "SOLVED" }, _max: { score: true } }),
    user.leaderboardEligible && user.leaderboardOptIn ? leaderboard({ limit: 100000, offset: 0, period:"all",category:"solved" }).catch(()=>null) : Promise.resolve(null),
    personalRankingPeriods(user.id),
    user.leaderboardEligible && user.leaderboardOptIn ? leaderboard({limit:100000,offset:0,period:"week",category:"solved"}).catch(()=>null) : Promise.resolve(null)
  ]);
  const totalBestScore = best.reduce((sum, row) => sum + (row._max.score ?? 0), 0);
  return { started, finished: solved + failed, solved, failed, successRate: solved + failed ? solved / (solved + failed) : null,
    distinctSolved: best.length, totalBestScore,
    rank: standings ? standings.items.find(item => item.userId === user.id)?.rank ?? null : null,
    weeklyRank: weeklyStandings ? weeklyStandings.items.find(item => item.userId === user.id)?.rank ?? null : null,
    periodStats: periodReport.periods,periodBasis:periodReport.periodBasis,
    leaderboardOptIn:user.leaderboardOptIn,leaderboardEligible: user.leaderboardEligible };
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
