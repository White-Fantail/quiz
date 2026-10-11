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
export async function myQuizInsights(p:Record<string,any>,actor:Actor|null) {
  const owner=requireActor(actor);
  const quiz=await db().quiz.findFirst({
    where:{id:p.quizId,authorId:owner.id},select:{id:true,currentVersion:true}});
  if(!quiz)fail(404,"not_found","Quiz not found");
  const selectedLocale=p.locale as "en"|"ko"|"und"|"all";
  const where={quizId:quiz.id,...(selectedLocale==="all"?{}:{locale:selectedLocale})};
  const reviewWhere={...where,kind:"QUIZ"};
  const now=Date.now(),lastWeek=new Date(now-7*86400000),
    previousWeek=new Date(now-14*86400000);
  const [states,clues,average,ratings,reviewCount,feedback,reasons,recent,prior,
    translationQuality,languages,uniqueReviewers]=await Promise.all([
    db().playSession.groupBy({by:["status"],where,_count:{_all:true}}),
    db().playSession.groupBy({by:["usedClues"],where:{...where,status:"SOLVED"},
      _count:{_all:true},orderBy:{usedClues:"asc"}}),
    db().playSession.aggregate({where:{...where,status:{in:["SOLVED","FAILED"]}},
      _avg:{usedClues:true}}),
    db().review.groupBy({by:["rating"],where:reviewWhere,_count:{_all:true}}),
    db().review.count({where:reviewWhere}),
    db().review.findMany({where:reviewWhere,select:{
      id:true,rating:true,comment:true,locale:true,revisionId:true,createdAt:true,
      author:{select:{displayName:true}}},
      orderBy:[{createdAt:"desc"},{id:"desc"}],skip:p.offset,take:p.limit}),
    db().report.groupBy({by:["reason"],where,_count:{_all:true}}),
    db().review.groupBy({by:["rating"],where:{...reviewWhere,updatedAt:{gte:lastWeek}},
      _count:{_all:true}}),
    db().review.groupBy({by:["rating"],where:{...reviewWhere,updatedAt:{gte:previousWeek,lt:lastWeek}},
      _count:{_all:true}}),
    db().review.groupBy({by:["rating"],where:{...where,kind:"TRANSLATION"},_count:{_all:true}}),
    db().playSession.groupBy({by:["locale","status"],where:{quizId:quiz.id},_count:{_all:true}}),
    db().review.groupBy({by:["authorId"],where:reviewWhere})
  ]);
  const statusCount=(s:string)=>states.find(x=>x.status===s)?._count._all??0;
  const started=states.reduce((sum,x)=>sum+x._count._all,0),
    solved=statusCount("SOLVED"),failed=statusCount("FAILED"),completed=solved+failed;
  const languageSummary=["en","ko","und"].map(locale=>{
    const rows=languages.filter(row=>row.locale===locale);
    const count=(status:string)=>rows.find(x=>x.status===status)?._count._all??0;
    const started=rows.reduce((sum,x)=>sum+x._count._all,0),solved=count("SOLVED"),failed=count("FAILED");
    return {locale,started,completed:solved+failed,solved,failed,
      successRate:solved+failed?solved/(solved+failed):null};
  });
  return {quizId:quiz.id,currentVersion:quiz.currentVersion,locale:selectedLocale,
    scope:selectedLocale==="all"?"ALL_LANGUAGES_AND_REVISIONS":"LOCALE_ALL_REVISIONS",
    languages:languageSummary,
    started,completed,solved,failed,inProgressOrAbandoned:started-completed,
    completionRate:started?completed/started:null,
    successRate:completed?solved/completed:null,
    averageCluesUsed:average._avg.usedClues,
    correctByClueStage:clues.map(c=>({stage:c.usedClues,correct:c._count._all})),
    reviews:{
      positive:ratings.find(x=>x.rating===1)?._count._all??0,
      negative:ratings.find(x=>x.rating===-1)?._count._all??0,
      total:reviewCount,uniqueReviewers:uniqueReviewers.length,items:feedback,
      offset:p.offset,limit:p.limit,hasMore:p.offset+feedback.length<reviewCount,
      trend:{
        last7Days:{positive:recent.find(x=>x.rating===1)?._count._all??0,
          negative:recent.find(x=>x.rating===-1)?._count._all??0},
        previous7Days:{positive:prior.find(x=>x.rating===1)?._count._all??0,
          negative:prior.find(x=>x.rating===-1)?._count._all??0}
      }
    },
    translationQuality:{
      positive:translationQuality.find(x=>x.rating===1)?._count._all??0,
      negative:translationQuality.find(x=>x.rating===-1)?._count._all??0
    },
    reports:{total:reasons.reduce((sum,x)=>sum+x._count._all,0),
      byReason:reasons.map(r=>({reason:r.reason,count:r._count._all}))},
    note:"Language and revision are sourced from pinned play sessions. Legacy records are und; user IDs and free-text reports are not exposed."};
}
