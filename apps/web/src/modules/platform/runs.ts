import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { ratingsForQuizzes, ratingsForQuiz, myRatingForQuiz, ratingAccess } from "./ratings";
import { fail, requireActor, type Actor } from "./auth";
import { utcWeekStart, WEEK_MS } from "./weekly-clock";
import { selectUnseen } from "./unseen-questions";
import { playableQuizWhere } from "./content-locale";
import type { Locale } from "../../i18n/core";

export type Lane = "GENERAL" | "KIDS";
export type RunMode = "WEEKLY" | "RANDOM_FIVE" | "INFINITE";
const weekMs = WEEK_MS;
export function validateWeek(start: string, now = new Date()): {start: Date; end: Date} {
  const date = new Date(start + "T00:00:00.000Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== start ||
      date.getUTCDay() !== 1 || date.getTime() < utcWeekStart(now).getTime() ||
      date.getTime() >= utcWeekStart(now).getTime() + 16 * weekMs)
    fail(400, "invalid_week", "Choose a Monday in UTC, from this week up to 15 weeks ahead");
  return { start: date, end: new Date(date.getTime() + weekMs) };
}
export function eligibleQuizWhere(lane: Lane): Record<string,unknown> {
  return { publication: "PUBLISHED", ...(lane === "KIDS"
    ? { safetyStatus: "APPROVED", kidsEligible: true }
    : { safetyStatus: { not: "RESTRICTED" } }) };
}
function hash(token: string) { return createHash("sha256").update(token).digest("hex"); }
function secret(): string {
  const s = process.env.PLAY_RUN_SECRET;
  if (!s || s.length < 32) fail(503, "play_unconfigured", "PLAY_RUN_SECRET must be configured securely");
  return s;
}
function authToken(runId: string, userId: string): string {
  return createHmac("sha256", secret()).update("clupio:run:v1:" + runId + ":" + userId).digest("base64url");
}
export function sessionToken(runToken: string, runId: string, index: number): string {
  return createHmac("sha256", runToken).update("clupio:round:v1:" + runId + ":" + index).digest("base64url");
}
function matchingToken(provided: string, expectedHash: string): boolean {
  const a=Buffer.from(hash(provided), "hex"), b=Buffer.from(expectedHash,"hex");
  return a.length === b.length && timingSafeEqual(a,b);
}
export async function checkedRun(id: string, token: string, actor: Actor|null) {
  const run=await db().playRun.findUnique({where:{id},include:{weekly:true}});
  if (!run || !matchingToken(token,run.tokenHash)) fail(404,"run_not_found","Play run was not found");
  if (run.userId && run.userId!==actor?.id) fail(403,"forbidden","Run belongs to another account");
  const kidBinding=await db().kidPlayRun.findUnique({where:{runId:id}});
  if(kidBinding && (actor?.childScope?.profileId!==kidBinding.profileId ||
      actor?.childScope?.deviceId!==kidBinding.deviceId))
    fail(403,"kid_play_forbidden","A child-only run requires its authorized device");
  if (run.status === "ACTIVE" && run.expiresAt.getTime() <= Date.now())
    fail(410,"run_expired","This play run has expired");
  return run;
}
function publicWeekly(item: any) {
  return { id:item.id, lane:item.lane, title:item.title, description:item.description,
    startsAt:item.weekStart, endsAt:item.weekEnd,
    host: { id:item.host.id, name:item.hostDisplayName || item.host.displayName, verified:item.verifiedHost },
    questionCount: 5, ...(item.status !== "SCHEDULED" ? {status:item.status} : {}) };
}
async function currentEdition(lane: Lane) {
  const now=new Date();
  return db().weeklyChallenge.findFirst({
    where:{lane,status:"SCHEDULED",weekStart:{lte:now},weekEnd:{gt:now}},
    include:{host:{select:{id:true,displayName:true}},questions:{orderBy:{position:"asc"},include:{quiz:true,revision:true}}},
  });
}
async function pinnedMediaApproved(revisions: Array<{clues: unknown;promptMediaIds:unknown}>): Promise<boolean> {
  const ids=new Set<string>();
  for (const revision of revisions) {
    for (const id of Array.isArray(revision.promptMediaIds)?revision.promptMediaIds:[]) {
      if(typeof id==="string") ids.add(id);
    }
    for (const clue of Array.isArray(revision.clues)?revision.clues:[]) {
      if(clue && typeof clue==="object" && "mediaId" in clue && typeof clue.mediaId==="string")
        ids.add(clue.mediaId);
    }
  }
  if(!ids.size) return true;
  const approved=await db().mediaAsset.count({where:{
    id:{in:[...ids]},status:"READY",moderationStatus:"APPROVED",deletedAt:null
  }});
  return approved===ids.size;
}
/** Approved per-language snapshots are immutable for the duration of the weekly edition. */
async function weeklySnapshots(item: any, locale: Locale) {
  const rows=await db().weeklyQuestionLocalization.findMany({
    where:{challengeId:item.id,locale},
    orderBy:{position:"asc"},
    include:{revision:{include:{localization:true}}}
  });
  if(rows.length!==5 || item.questions.length!==5) return [];
  if(rows.some((row,i)=>row.position!==item.questions[i].position ||
      row.revision.quizId!==item.questions[i].quizId ||
      row.revision.localization?.locale!==locale ||
      row.revision.localization.status!=="PUBLISHED" ||
      (item.lane==="KIDS" && !["ORIGINAL","LEGACY"].includes(row.revision.localization.origin)))) return [];
  return rows;
}
async function editionAvailable(item: any, locale: Locale): Promise<boolean> {
  const snapshots = await weeklySnapshots(item,locale);
  return item.questions.length===5 &&
    item.questions.every((q:any) => q.quiz.publication==="PUBLISHED" &&
      q.quiz.safetyStatus!=="RESTRICTED" &&
      (item.lane!=="KIDS" || (q.quiz.safetyStatus==="APPROVED" && q.quiz.kidsEligible))) &&
    snapshots.length===5 &&
    await pinnedMediaApproved(snapshots.map(q=>q.revision));
}
export async function weeklyCurrent(p:Record<string,any>) {
  const edition=await currentEdition(p.lane);
  const start=utcWeekStart();
  if (!edition) return {available:false,lane:p.lane,weekStart:start,weekEnd:new Date(start.getTime()+weekMs),
    message:"이번 주의 다섯 문제는 아직 공개되지 않았어요."};
  const available=await editionAvailable(edition,p.locale);
  return {available,locale:p.locale,...publicWeekly(edition),
    message:available?undefined:"안전성 검토를 위해 이번 주 챌린지가 일시 중단되었어요."};
}
export async function weeklySubmit(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  const {start,end}=validateWeek(p.weekStart);
  if (new Date().getTime() >= start.getTime())
    fail(409,"week_started","Please submit before the weekly edition begins");
  const existing=await db().weeklyChallenge.count({
    where:{hostId:user.id,weekStart:start,lane:p.lane,status:"SUBMITTED"}});
  if (existing>=3) fail(429,"proposal_limit","At most three submissions per creator and week");
  const quizzes=await db().quiz.findMany({
    where:{id:{in:p.quizIds},authorId:user.id,...eligibleQuizWhere(p.lane)},
    include:{revisions:{where:{localization:{origin:{in:["ORIGINAL","LEGACY"]}}},orderBy:{version:"desc"},take:1}}
  });
  if (quizzes.length!==5) fail(422,"invalid_weekly_questions","All five questions must be your own published and lane-eligible quizzes");
  const snapshot=new Map(quizzes.map(q=>[q.id,{revisionId:q.revisions[0]?.id,version:q.currentVersion}]));
  if (quizzes.some(q=>!snapshot.get(q.id)?.revisionId || q.revisions[0]?.version!==q.currentVersion))
    fail(409,"invalid_revision","Each quiz must have a current revision");
  const proposal=await db().weeklyChallenge.create({data:{
    hostId:user.id,lane:p.lane,weekStart:start,weekEnd:end,title:p.title,description:p.description,
    questions:{create:p.quizIds.map((quizId:string,position:number)=>({position,quizId,revisionId:snapshot.get(quizId)!.revisionId!}))}
  }});
  return {id:proposal.id,status:"SUBMITTED",hostId:user.id,questionCount:5,startsAt:start,endsAt:end,
    message:"제출 완료. 이번 주 출제자 확정은 운영자의 편성 승인이 필요해요."};
}
export async function weeklyPublish(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  if(user.role!=="ADMIN") fail(403,"admin_required","Weekly scheduling requires trusted admin authority");
  const item=await db().weeklyChallenge.findUnique({
    where:{id:p.challengeId},include:{host:{select:{displayName:true}},questions:{orderBy:{position:"asc"},include:{quiz:true,revision:true}}},
  });
  if(!item || item.status!=="SUBMITTED") fail(404,"proposal_not_found","Unscheduled proposal not found");
  if(new Date()>=item.weekStart) fail(409,"week_started","Cannot schedule a week already started");
  if(item.questions.length!==5) fail(422,"invalid_weekly_questions","Weekly requires exactly five questions");
  if(item.questions.some(q=> q.quiz.authorId!==item.hostId || q.quiz.publication!=="PUBLISHED" ||
    q.quiz.currentVersion!==q.revision.version || q.quiz.safetyStatus==="RESTRICTED" ||
    (item.lane==="KIDS" && !(q.quiz.safetyStatus==="APPROVED" && q.quiz.kidsEligible))))
    fail(409,"weekly_question_unavailable","All five snapshots must remain authored, published and safe for the lane");
  if(!await pinnedMediaApproved(item.questions.map(q=>q.revision)))
    fail(409,"media_review_pending","All featured media must remain approved");
  const snapshots: Array<{challengeId:string;position:number;locale:string;revisionId:string}> = [];
  for (const locale of ["en","ko"] as const) {
    const locs=await db().quizLocalization.findMany({
      where:{quizId:{in:item.questions.map(q=>q.quizId)},locale,status:"PUBLISHED"},
      include:{revisions:{select:{id:true,version:true}}}
    });
    if(locs.length!==5 || locs.some(l=>l.publishedVersion==null || !l.revisions.some(r=>r.version===l.publishedVersion))) continue;
    const byQuiz=new Map(locs.map(l=>[l.quizId,l.revisions.find(r=>r.version===l.publishedVersion)!.id]));
    const localizedRevisions=await db().quizRevision.findMany({where:{id:{in:[...byQuiz.values()]}}});
    if(!await pinnedMediaApproved(localizedRevisions)) continue;
    for(const q of item.questions) snapshots.push({
      challengeId:item.id,position:q.position,locale,revisionId:byQuiz.get(q.quizId)!
    });
  }
  if(!snapshots.length)
    fail(409,"weekly_no_locales","All five questions require a verified published language version");

  try {
    await db().$transaction(async tx=>{
      await tx.weeklyQuestionLocalization.createMany({data:snapshots});
      const updated=await tx.weeklyChallenge.updateMany({
        where:{id:item.id,status:"SUBMITTED"},
        data:{status:"SCHEDULED",publishedAt:new Date(),verifiedHost:p.verifiedHost,
          hostDisplayName:item.host.displayName},
      });
      if(updated.count!==1) fail(409,"already_scheduled","This proposal has already changed");
      await tx.auditLog.create({data:{actorId:user.id,action:"weekly.publish",objectId:item.id,
        detail:{weekStart:item.weekStart.toISOString(),lane:item.lane,hostId:item.hostId,verifiedHost:p.verifiedHost}}});
      return updated;
    });
    return {id:item.id,status:"SCHEDULED",lane:item.lane,startsAt:item.weekStart,questionCount:5};
  } catch(error:any) {
    if(error?.code==="P2002") fail(409,"weekly_already_filled","This week and audience already have a featured host");
    throw error;
  }
}
function shuffle<T>(items:T[]):T[] {
  const out=[...items];
  for(let i=out.length-1;i>0;i--) {
    // Use Node crypto instead of Math.random for unbiased random practice selection.
    const bytes=randomBytes(4).readUInt32BE(0);
    const j=bytes%(i+1);[out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}
async function userExcludedQuestions(userId:string):Promise<string[]> {
  const [sessions,allocated]=await Promise.all([
    db().playSession.findMany({where:{userId},select:{quizId:true}}),
    db().playRunQuestion.findMany({where:{run:{userId}},select:{quizId:true}})
  ]);
  return [...new Set([...sessions,...allocated].map(row=>row.quizId))];
}
async function randomChoices(lane:Lane,locale:Locale,count:number,avoid:string[]=[],allowEmpty=false) {
  const reserved=await db().weeklyQuestion.findMany({
    where:{challenge:{status:"SCHEDULED",weekEnd:{gt:new Date()}}},
    select:{quizId:true}
  });
  const blocked=new Set(reserved.map(row=>row.quizId));
  const pool=await db().quiz.findMany({where:playableQuizWhere(locale,lane),
    select:{id:true,localizations:{where:{locale,status:"PUBLISHED"},select:{
      id:true,currentVersion:true,publishedVersion:true,
      revisions:{select:{id:true,version:true}}
    }}}});
  const eligible=pool.filter(q=>{
    const loc=q.localizations[0];
    return loc?.publishedVersion != null && loc.revisions.some(r=>r.version===loc.publishedVersion) && !blocked.has(q.id);
  });
  const choice=shuffle(selectUnseen(eligible,avoid)).slice(0,count);
  if(choice.length<count) {
    if(allowEmpty) return [];
    fail(409,"not_enough_questions",count===5
      ? "Not enough new quizzes in the selected language to start five questions."
      : "No unseen quizzes remain in the selected language.");
  }
  return choice.map(q=>({quizId:q.id,revisionId:q.localizations[0].revisions.find(r=>r.version===q.localizations[0].publishedVersion)!.id}));
}
export async function runStart(p:Record<string,any>,actor:Actor|null) {
  const mode=p.mode as RunMode, lane=p.lane as Lane, locale=p.locale as Locale;
  const edition=mode==="WEEKLY"?await currentEdition(lane):null;
  if(mode==="WEEKLY" && (!edition || !await editionAvailable(edition,locale)))
    fail(409,"weekly_unavailable","이번 주의 공식 챌린지가 아직 공개되지 않았어요");
  if(edition && actor) {
    const existing=await db().playRun.findFirst({where:{weeklyId:edition.id,userId:actor.id,mode:"WEEKLY"}});
    if(existing && existing.locale!==locale)
      fail(409,"weekly_locale_locked","Weekly participation is locked to the language first selected");
    if(existing) return {runId:existing.id,runToken:authToken(existing.id,actor.id),mode,lane,locale,
      status:existing.status,score:existing.score,completed:existing.currentIndex,total:5,
      weekly:publicWeekly(edition),official:existing.officialEligible,resumed:true};
  }
  const avoid=mode==="WEEKLY"?[]:[
    ...(actor?await userExcludedQuestions(actor.id):[]),...(p.avoidQuizIds||[])
  ];
  const questions=mode==="WEEKLY"
    ? (await weeklySnapshots(edition!,locale)).map(q=>({
      quizId:q.revision.quizId,revisionId:q.revisionId
    }))
    : await randomChoices(lane,locale,mode==="RANDOM_FIVE"?5:1,avoid);
  const preseen=mode==="WEEKLY"&&actor ? await db().playSession.findFirst({
    where:{userId:actor.id,quizId:{in:questions.map(q=>q.quizId)}},select:{id:true}
  }):null;
  const officialEligible=mode==="WEEKLY"&&!!actor&&edition?.hostId!==actor.id&&!preseen;
  const id=randomUUID();
  const runToken=actor?authToken(id,actor.id):randomBytes(32).toString("base64url");
  const expiresAt=edition?edition.weekEnd:new Date(Date.now()+(mode==="INFINITE"?7:2)*86400000);
  try {
    const run=await db().playRun.create({data:{
      id,mode,lane,locale,userId:actor?.id,weeklyId:edition?.id,officialEligible,
      tokenHash:hash(runToken),expiresAt,
      questions:{create:questions.map((q,index)=>({...q,position:index}))}
    }});
    return {runId:run.id,runToken,mode,lane,locale,status:"ACTIVE",completed:0,score:0,
      total:mode==="INFINITE"?null:5,weekly:edition?publicWeekly(edition):null,
      official:officialEligible};
  } catch(error:any) {
    if(error?.code==="P2002" && mode==="WEEKLY" && actor)
      return runStart(p,actor);
    throw error;
  }
}
function runSummary(run:any) {
  return {runId:run.id,mode:run.mode,lane:run.lane,locale:run.locale,status:run.status,
    completed:run.currentIndex,total:run.mode==="INFINITE"?null:5,
    score:run.score,solved:run.solved,failed:run.failed,
    official:run.mode==="WEEKLY"&&run.officialEligible&&!!run.userId&&run.weekly?.hostId!==run.userId,
    completedAt:run.completedAt};
}
export async function runCurrent(p:Record<string,any>,actor:Actor|null) {
  const run=await checkedRun(p.runId,p.runToken,actor);
  if (p.locale && run.locale!==p.locale) fail(409,"locale_mismatch","Run language cannot be changed mid-game");
  if(run.status==="FINISHED") return runSummary(run);
  if(run.mode==="WEEKLY") {
    if(!run.weekly || run.weekly.status!=="SCHEDULED" ||
      run.weekly.weekEnd <= new Date()) fail(410,"week_closed","이번 주 챌린지가 종료됐어요");
  }
  let round=await db().playRunQuestion.findUnique({where:{runId_position:{runId:run.id,position:run.currentIndex}}});
  if(!round && run.mode==="INFINITE") {
    const old=await db().playRunQuestion.findMany({where:{runId:run.id},select:{quizId:true}});
    const exclude=[...old.map(o=>o.quizId),...(run.userId?await userExcludedQuestions(run.userId):[]),
      ...(p.avoidQuizIds||[])];
    const chosen=(await randomChoices(run.lane as Lane,run.locale as Locale,1,exclude,true))[0];
    if(!chosen) {
      await db().playRun.updateMany({where:{id:run.id,status:"ACTIVE",currentIndex:run.currentIndex},
        data:{status:"FINISHED",completedAt:new Date()}});
      const done=await db().playRun.findUniqueOrThrow({where:{id:run.id},include:{weekly:true}});
      return {...runSummary(done),exhausted:done.status==="FINISHED",
        message:"아직 풀지 않은 문제를 모두 발견했어요. 새로운 퀴즈가 공개되면 다시 즐겨 주세요."};
    }
    try {
      round=await db().playRunQuestion.create({data:{runId:run.id,position:run.currentIndex,...chosen}});
    } catch(error:any) {
      if(error?.code!=="P2002") throw error;
      round=await db().playRunQuestion.findUnique({where:{runId_position:{runId:run.id,position:run.currentIndex}}});
    }
  }
  if(!round) fail(409,"no_more_questions","No further questions in this run");
  const quiz=await db().quiz.findUnique({where:{id:round.quizId}});
  if(!quiz || quiz.publication!=="PUBLISHED" || quiz.safetyStatus==="RESTRICTED" ||
    (run.lane==="KIDS" && !(quiz.safetyStatus==="APPROVED"&&quiz.kidsEligible)))
    fail(409,"question_suspended","This question is temporarily unavailable for safety review");
  const revision=await db().quizRevision.findUnique({where:{id:round.revisionId},include:{localization:true}});
  if(!revision || revision.localization?.locale!==run.locale ||
    revision.localization.status!=="PUBLISHED" || !(revision.clues as unknown[]).length)
    fail(409,"invalid_question","The pinned question version is unavailable");
  if(!await pinnedMediaApproved([revision]))
    fail(409,"question_suspended","This pinned question contains unapproved or restricted media");
  const token=sessionToken(p.runToken,run.id,run.currentIndex);
  let session=await db().playSession.findUnique({where:{runId_roundIndex:{runId:run.id,roundIndex:run.currentIndex}}});
  if(!session) {
    try {
      session=await db().playSession.create({data:{
        quizId:round.quizId,revisionId:round.revisionId,locale:run.locale,userId:run.userId,
        runId:run.id,roundIndex:run.currentIndex,tokenHash:hash(token),
        usedClues:1,expiresAt:run.expiresAt
      }});
    }catch(error:any){
      if(error?.code!=="P2002") throw error;
      session=await db().playSession.findUnique({where:{runId_roundIndex:{runId:run.id,roundIndex:run.currentIndex}}});
    }
  }
  if(!session) fail(409,"run_conflict","Retry the current question");
  const clues=revision.clues as Array<Record<string,unknown>>;
  const [ratings,myRating]=await Promise.all([ratingsForQuiz(quiz.id,run.locale as Locale),myRatingForQuiz(quiz.id,actor,run.locale as Locale)]);
  return {...runSummary(run),sessionId:session.id,sessionToken:token,
    ratings,myRating,ratingAccess:ratingAccess(actor,quiz.authorId,session.userId),
    round:run.currentIndex+1,quizId:round.quizId,locale:run.locale,quizVersion:revision.version,
    title:revision.title,prompt:revision.prompt,promptMediaIds:revision.promptMediaIds,
    clueIndex:session.usedClues,clueCount:clues.length,
    clues:clues.slice(0,session.usedClues),sessionStatus:session.status,
    canGuess:session.status==="ACTIVE"&&session.wrongGuesses<session.usedClues,
    ...(session.status!=="ACTIVE"?{scoreThisQuestion:session.score}:{}),
  };
}
export async function runFinish(p:Record<string,any>,actor:Actor|null) {
  const run=await checkedRun(p.runId,p.runToken,actor);
  if(run.mode!=="INFINITE") fail(403,"finish_not_allowed","Official and five-round runs must complete five questions");
  if(run.status==="FINISHED") return runSummary(run);
  const updated=await db().playRun.update({where:{id:run.id},data:{status:"FINISHED",completedAt:new Date()}});
  return runSummary(updated);
}
/** Display finished questions only. Never expose answers or unplayed rounds. */
export async function runFeedback(p:Record<string,any>,actor:Actor|null) {
  const run=await checkedRun(p.runId,p.runToken,actor);
  if(run.status!=="FINISHED")fail(409,"run_in_progress","Finish the run before rating questions");
  const recentFirst=run.mode==="INFINITE";
  const sessions=await db().playSession.findMany({
    where:{runId:run.id,status:{in:["SOLVED","FAILED"]}},
    select:{quizId:true,userId:true,roundIndex:true,revision:{select:{title:true,localization:{select:{origin:true}}}},
      quiz:{select:{authorId:true}}},
    orderBy:{roundIndex:recentFirst?"desc":"asc"},take:5
  });
  if(recentFirst)sessions.reverse();
  const ids=sessions.map(s=>s.quizId);
  const [ratings,previous,translationRatings]=await Promise.all([
    ratingsForQuizzes(ids,run.locale as Locale),
    actor&&ids.length?db().review.findMany({
      where:{authorId:actor.id,quizId:{in:ids},locale:run.locale,kind:"QUIZ"},select:{quizId:true,rating:true}
    }):Promise.resolve([]),
    actor&&ids.length?db().review.findMany({where:{authorId:actor.id,quizId:{in:ids},locale:run.locale,kind:"TRANSLATION"},select:{quizId:true,rating:true}}):Promise.resolve([])
  ]);
  const saved=new Map(previous.map(r=>[r.quizId,r.rating]));
  const savedTranslation=new Map(translationRatings.map(r=>[r.quizId,r.rating]));
  return {runId:run.id,locale:run.locale,items:sessions.map(s=>({
    quizId:s.quizId,title:s.revision.title,round:(s.roundIndex??0)+1,
    ratings:ratings.get(s.quizId),myRating:saved.get(s.quizId)??null,
    isTranslation:s.revision.localization?.origin==="TRANSLATION",
    myTranslationRating:savedTranslation.get(s.quizId)??null,
    ratingAccess:ratingAccess(actor,s.quiz.authorId,s.userId)
  }))};
}
export async function runHistory(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  const rows=await db().playRun.findMany({where:{userId:user.id},orderBy:{startedAt:"desc"},
    skip:p.offset,take:p.limit,include:{weekly:{include:{host:{select:{id:true,displayName:true}}}}}});
  return {items:rows.map(run=>({...runSummary(run),startedAt:run.startedAt,
    weekly:run.weekly?publicWeekly(run.weekly):null})),offset:p.offset,limit:p.limit};
}
export async function weeklyProposals(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  if(user.role!=="ADMIN") fail(403,"admin_required","Only administrators can review weekly proposals");
  const where={status:"SUBMITTED",...(p.lane?{lane:p.lane}:{}),
    ...(p.weekStart?{weekStart:new Date(p.weekStart+"T00:00:00.000Z")}:{})};
  const rows=await db().weeklyChallenge.findMany({where,orderBy:[{weekStart:"asc"},{createdAt:"asc"}],
    take:p.limit,skip:p.offset,
    include:{host:{select:{id:true,displayName:true}},questions:{orderBy:{position:"asc"},include:{revision:{select:{title:true}}}}}});
  return {items:rows.map(row=>({...publicWeekly(row),status:row.status,
    questions:row.questions.map(q=>({position:q.position+1,title:q.revision.title,quizId:q.quizId}))})),
    offset:p.offset,limit:p.limit};
}
export async function weeklySuspend(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  if(user.role!=="ADMIN") fail(403,"admin_required","Only administrators can suspend editions");
  const edition=await db().weeklyChallenge.findUnique({where:{id:p.challengeId}});
  if(!edition||edition.status!=="SCHEDULED") fail(404,"not_found","Scheduled edition not found");
  await db().$transaction(async tx=>{
    const updated=await tx.weeklyChallenge.updateMany({
      where:{id:edition.id,status:"SCHEDULED"},data:{status:"SUSPENDED"}});
    if(updated.count!==1) fail(409,"conflict","Edition status changed");
    await tx.auditLog.create({data:{actorId:user.id,action:"weekly.suspend",objectId:edition.id,
      detail:{reason:p.reason,lane:edition.lane,weekStart:edition.weekStart.toISOString()}}});
  });
  return {challengeId:edition.id,status:"SUSPENDED"};
}
export async function weeklyStandings(p:Record<string,any>) {
  const edition=await db().weeklyChallenge.findUnique({where:{id:p.challengeId}});
  if(!edition || edition.status!=="SCHEDULED" || edition.lane!=="GENERAL")
    fail(404,"not_found","Public standings not available");
  // Push privacy and rank calculations into PostgreSQL; no 10k-user in-memory cap.
  // The score is the only rank criterion, so tied scores always share placement.
  const rows=await db().$queryRaw<Array<{
    rank:number;displayName:string;score:number;solved:number;total:number
  }>>`
    SELECT (RANK() OVER (ORDER BY pr."score" DESC))::INTEGER AS "rank",
           u."displayName" AS "displayName", pr."score" AS "score",
           pr."solved" AS "solved", (COUNT(*) OVER ())::INTEGER AS "total"
    FROM "PlayRun" pr
    JOIN "User" u ON u."id"=pr."userId"
    WHERE pr."weeklyId"=${edition.id} AND pr."locale"=${p.locale} AND pr."mode"='WEEKLY' AND pr."status"='FINISHED'
      AND pr."officialEligible"=TRUE AND u."leaderboardEligible"=TRUE AND u."leaderboardOptIn"=TRUE
      AND pr."userId" <> ${edition.hostId}
    ORDER BY pr."score" DESC, pr."completedAt" ASC
    LIMIT ${p.limit} OFFSET ${p.offset}
  `;
  let total=rows[0]?.total ?? 0;
  if(!rows.length && p.offset>0) {
    const fallback=await db().$queryRaw<Array<{total:number}>>`
      SELECT COUNT(*)::INTEGER AS "total" FROM "PlayRun" pr
      JOIN "User" u ON u."id"=pr."userId"
      WHERE pr."weeklyId"=${edition.id} AND pr."locale"=${p.locale} AND pr."mode"='WEEKLY' AND pr."status"='FINISHED'
        AND pr."officialEligible"=TRUE AND u."leaderboardEligible"=TRUE AND u."leaderboardOptIn"=TRUE
        AND pr."userId" <> ${edition.hostId}
    `;
    total=fallback[0]?.total??0;
  }
  return {challengeId:edition.id,locale:p.locale,
    items:rows.map(row=>({rank:row.rank,displayName:row.displayName,score:row.score,solved:row.solved})),
    total,rankingBasis:"first official attempt; verified opt-in adult accounts only; score ties share rank"};
}

/** Private per-language weekly summary, never expose player names or individual answers. */
export async function weeklyInsights(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  const edition=await db().weeklyChallenge.findUnique({
    where:{id:p.challengeId},
    select:{id:true,hostId:true,lane:true,status:true,weekStart:true}
  });
  if(!edition)fail(404,"not_found","Weekly challenge not found");
  if(user.role!=="ADMIN" && edition.hostId!==user.id)
    fail(403,"forbidden","Weekly insights are only for the host or an administrator");
  const locale=p.locale as "en"|"ko"|"und"|"all";
  const where={weeklyId:edition.id,mode:"WEEKLY",...(locale==="all"?{}:{locale})};
  const [grouped,stages]=await Promise.all([
    db().playRun.groupBy({by:["locale","status"],where,
      _count:{_all:true},_avg:{score:true},_sum:{score:true,solved:true,failed:true}}),
    db().playSession.groupBy({by:["locale","status"],where:{
      run:{weeklyId:edition.id,mode:"WEEKLY"},...(locale==="all"?{}:{locale})
    },_count:{_all:true}})
  ]);
  const languages=["en","ko","und"].map(language=>{
    const runs=grouped.filter(row=>row.locale===language);
    const completed=runs.find(row=>row.status==="FINISHED");
    const rounds=stages.filter(row=>row.locale===language);
    const count=(status:string)=>rounds.find(row=>row.status===status)?._count._all??0;
    const solved=count("SOLVED"),failed=count("FAILED");
    const started=runs.reduce((sum,row)=>sum+row._count._all,0);
    return {locale:language,started,finished:completed?._count._all??0,
      roundsCompleted:solved+failed,solved,failed,
      successRate:solved+failed?solved/(solved+failed):null,
      averageCompletedRunScore:completed?._avg.score??null};
  });
  return {challengeId:edition.id,lane:edition.lane,status:edition.status,locale,
    weekStart:edition.weekStart,
    languages:locale==="all"?languages:languages.filter(item=>item.locale===locale),
    note:"Private aggregate statistics only; no player identities, raw answers or child rankings."};
}
