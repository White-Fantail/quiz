import { db } from "./db";
import { fail, requireActor, type Actor } from "./auth";
import { ratingSummary } from "../quiz/rating-metadata";
import { playableQuizWhere } from "./content-locale";

/** A pack owns its reputation; its component quizzes retain their separate ratings. */
export async function packRatingsFor(ids:string[],locale:string) {
  const unique=[...new Set(ids)];
  const result=new Map<string,ReturnType<typeof ratingSummary>>();
  if(!unique.length)return result;
  const rows=await db().packReview.groupBy({
    by:["packId","rating"],where:{packId:{in:unique},locale},_count:{_all:true}
  });
  for(const id of unique) {
    const matching=rows.filter(r=>r.packId===id);
    result.set(id,ratingSummary(
      matching.find(r=>r.rating===1)?._count._all??0,
      matching.find(r=>r.rating===-1)?._count._all??0
    ));
  }
  return result;
}
export async function packRatingFor(id:string,locale:string) {
  return (await packRatingsFor([id],locale)).get(id)??ratingSummary(0,0);
}

/** Returns only a public pack with all questions eligible in this locale. */
async function publicPack(id:string,locale:string) {
  const pack=await db().quizPack.findFirst({
    where:{id,publication:"PUBLISHED",localizations:{some:{locale,status:"PUBLISHED"}}},
    select:{id:true,authorId:true,currentVersion:true,
      items:{select:{quizId:true}}}
  });
  if(!pack||!pack.items.length)fail(404,"pack_unavailable","Published quiz pack not found");
  const count=await db().quiz.count({where:{
    id:{in:pack.items.map(i=>i.quizId)},...playableQuizWhere(locale as "en"|"ko")
  }});
  if(count!==pack.items.length)fail(404,"pack_unavailable","Some pack questions are unavailable");
  return pack;
}
export async function packReviewsList(p:Record<string,any>) {
  await publicPack(p.id,p.locale);
  const where={packId:p.id,locale:p.locale};
  const [rows,count,ratings]=await Promise.all([
    db().packReview.findMany({where,select:{id:true,rating:true,comment:true,createdAt:true,
      author:{select:{displayName:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}],
      take:p.limit,skip:p.offset}),
    db().packReview.count({where}),
    packRatingFor(p.id,p.locale)
  ]);
  return {locale:p.locale,count,ratings,items:rows};
}
export async function packReviewUpsert(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  if(user.childScope)fail(403,"child_reviews_disabled","Child accounts cannot post public reviews");
  const pack=await publicPack(p.id,p.locale);
  if(pack.authorId===user.id)fail(403,"self_review","You cannot rate your own quiz pack");
  const completed=await db().playRun.findFirst({
    where:{packId:pack.id,userId:user.id,mode:"PACK",lane:"GENERAL",
      locale:p.locale,status:"FINISHED",completedAt:{not:null},
      currentIndex:{gte:pack.items.length}},
    select:{id:true,packVersion:true},
    orderBy:{completedAt:"desc"}
  });
  // A creator may edit the pack after a completed play. The run's own
  // completion and immutable targetCount, not current membership, is proof.
  const proof=completed??await db().playRun.findFirst({
    where:{packId:pack.id,userId:user.id,mode:"PACK",lane:"GENERAL",
      locale:p.locale,status:"FINISHED",completedAt:{not:null}},
    select:{id:true,packVersion:true},orderBy:{completedAt:"desc"}
  });
  if(!proof)fail(403,"play_required","Finish this pack in this language before rating");
  const saved=await db().packReview.upsert({
    where:{packId_authorId_locale:{packId:pack.id,authorId:user.id,locale:p.locale}},
    create:{packId:pack.id,authorId:user.id,locale:p.locale,
      packVersionAtReview:proof.packVersion??pack.currentVersion,
      rating:p.rating,comment:p.comment},
    update:{rating:p.rating,comment:p.comment,
      packVersionAtReview:proof.packVersion??pack.currentVersion}
  });
  return {id:saved.id,rating:saved.rating,comment:saved.comment,
    locale:saved.locale,ratings:await packRatingFor(pack.id,p.locale)};
}
export async function packReviewRemove(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  if(user.childScope)fail(403,"child_reviews_disabled","Child accounts cannot post public reviews");
  const removed=await db().packReview.deleteMany({where:{
    packId:p.id,authorId:user.id,locale:p.locale
  }});
  return {removed:removed.count>0,locale:p.locale,
    ratings:await packRatingFor(p.id,p.locale)};
}
export async function packReportCreate(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  if(user.childScope)fail(403,"child_reports_disabled","Child accounts use the parental safety report workflow");
  await publicPack(p.id,p.locale);
  const since=new Date(Date.now()-86400000);
  const [quizReports,packReports]=await Promise.all([
    db().report.count({where:{reporterId:user.id,createdAt:{gte:since}}}),
    db().packReport.count({where:{reporterId:user.id,createdAt:{gte:since}}})
  ]);
  if(quizReports+packReports>=10)fail(429,"rate_limit","Daily report limit reached");
  const item=await db().packReport.create({data:{
    packId:p.id,reporterId:user.id,locale:p.locale,
    reason:p.reason,detail:p.detail
  }});
  return {id:item.id,status:item.status,createdAt:item.createdAt};
}
/** Owner-only, aggregated insights: no per-player activity or child identities. */
export async function packInsightsMine(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  const pack=await db().quizPack.findFirst({where:{id:p.id,authorId:user.id},
    select:{id:true,items:{select:{quizId:true}}}});
  if(!pack)fail(404,"not_found","Owned pack not found");
  const where={packId:pack.id,mode:"PACK",lane:"GENERAL",
    ...(p.locale==="all"?{}:{locale:p.locale})};
  const [status,accuracy,reviews,reportCounts]=await Promise.all([
    db().playRun.groupBy({by:["status"],where,_count:{_all:true}}),
    db().playRun.aggregate({where:{...where,status:"FINISHED"},
      _avg:{solved:true,failed:true,targetCount:true},_count:{_all:true}}),
    db().packReview.groupBy({by:["rating"],where:{packId:pack.id,
      ...(p.locale==="all"?{}:{locale:p.locale})},_count:{_all:true}}),
    db().packReport.groupBy({by:["reason"],where:{packId:pack.id,
      ...(p.locale==="all"?{}:{locale:p.locale})},_count:{_all:true}})
  ]);
  return {id:pack.id,questionCount:pack.items.length,locale:p.locale,
    runs:status.reduce((v,x)=>v+x._count._all,0),
    completed:status.find(x=>x.status==="FINISHED")?._count._all??0,
    averageSolved:accuracy._avg.solved,averageFailed:accuracy._avg.failed,
    averagePackLength:accuracy._avg.targetCount,
    ratings:{positive:reviews.find(x=>x.rating===1)?._count._all??0,
      negative:reviews.find(x=>x.rating===-1)?._count._all??0},
    reportCounts:reportCounts.map(r=>({reason:r.reason,count:r._count._all}))};
}
