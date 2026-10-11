import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { fail, requireActor, type Actor } from "./auth";
import { utcWeekStart, WEEK_MS } from "./weekly-clock";

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
async function editionAvailable(item: any): Promise<boolean> {
  return item.questions.length===5 &&
    item.questions.every((q:any) => q.quiz.publication==="PUBLISHED" &&
      q.quiz.safetyStatus!=="RESTRICTED" &&
      (item.lane!=="KIDS" || (q.quiz.safetyStatus==="APPROVED" && q.quiz.kidsEligible))) &&
    await pinnedMediaApproved(item.questions.map((q:any)=>q.revision));
}
export async function weeklyCurrent(p:Record<string,any>) {
  const edition=await currentEdition(p.lane);
  const start=utcWeekStart();
  if (!edition) return {available:false,lane:p.lane,weekStart:start,weekEnd:new Date(start.getTime()+weekMs),
    message:"이번 주의 다섯 문제는 아직 공개되지 않았어요."};
  const available=await editionAvailable(edition);
  return {available,...publicWeekly(edition),
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
    include:{revisions:{where:{version:{gte:1}},orderBy:{version:"desc"},take:1}}
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
  try {
    await db().$transaction(async tx=>{
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
async function randomChoices(lane: Lane,count:number,avoid:string[]=[]) {
  // Keep pool bounded; random five requires five distinct questions in a run.
  const reserved=await db().weeklyQuestion.findMany({
    where:{challenge:{status:"SCHEDULED",weekEnd:{gt:new Date()}}},
    select:{quizId:true}
  });
  const reservedIds=reserved.map(row=>row.quizId);
  const pool=await db().quiz.findMany({where:{...eligibleQuizWhere(lane),id:{notIn:reservedIds}},
    orderBy:{updatedAt:"desc"},take:2000,select:{id:true,currentVersion:true,
      revisions:{orderBy:{version:"desc"},take:1,select:{id:true}}}});
  const eligible=pool.filter(q=>q.revisions[0]?.id);
  const candidates=eligible.filter(q=>!avoid.includes(q.id));
  const choice=shuffle(candidates.length>=count?candidates:eligible).slice(0,count);
  if(choice.length<count) fail(409,"not_enough_questions",
    count===5 ? "랜덤 5문제를 시작하려면 공개 문제가 다섯 개 필요해요." : "이 모드를 시작하려면 공개 문제가 하나 이상 필요해요.");
  return choice.map(q=>({quizId:q.id,revisionId:q.revisions[0].id}));
}
export async function runStart(p:Record<string,any>,actor:Actor|null) {
  const mode=p.mode as RunMode, lane=p.lane as Lane;
  const edition=mode==="WEEKLY"?await currentEdition(lane):null;
  if(mode==="WEEKLY" && (!edition || !await editionAvailable(edition)))
    fail(409,"weekly_unavailable","이번 주의 공식 챌린지가 아직 공개되지 않았어요");
  if(edition && actor) {
    const existing=await db().playRun.findFirst({where:{weeklyId:edition.id,userId:actor.id,mode:"WEEKLY"}});
    if(existing) return {runId:existing.id,runToken:authToken(existing.id,actor.id),mode,lane,
      status:existing.status,score:existing.score,completed:existing.currentIndex,total:5,
      weekly:publicWeekly(edition),resumed:true};
  }
  const questions=mode==="WEEKLY"
    ? edition!.questions.map(q=>({quizId:q.quizId,revisionId:q.revisionId}))
    : await randomChoices(lane,mode==="RANDOM_FIVE"?5:1);
  const id=randomUUID();
  const runToken=actor?authToken(id,actor.id):randomBytes(32).toString("base64url");
  const expiresAt=edition?edition.weekEnd:new Date(Date.now()+(mode==="INFINITE"?7:2)*86400000);
  try {
    const run=await db().playRun.create({data:{
      id,mode,lane,userId:actor?.id,weeklyId:edition?.id,
      tokenHash:hash(runToken),expiresAt,
      questions:{create:questions.map((q,index)=>({...q,position:index}))}
    }});
    return {runId:run.id,runToken,mode,lane,status:"ACTIVE",completed:0,score:0,
      total:mode==="INFINITE"?null:5,weekly:edition?publicWeekly(edition):null,
      official:mode==="WEEKLY"&&!!actor&&edition?.hostId!==actor.id};
  } catch(error:any) {
    if(error?.code==="P2002" && mode==="WEEKLY" && actor)
      return runStart(p,actor);
    throw error;
  }
}
function runSummary(run:any) {
  return {runId:run.id,mode:run.mode,lane:run.lane,status:run.status,
    completed:run.currentIndex,total:run.mode==="INFINITE"?null:5,
    score:run.score,solved:run.solved,failed:run.failed,
    official:run.mode==="WEEKLY"&&!!run.userId&&run.weekly?.hostId!==run.userId,
    completedAt:run.completedAt};
}
export async function runCurrent(p:Record<string,any>,actor:Actor|null) {
  const run=await checkedRun(p.runId,p.runToken,actor);
  if(run.status==="FINISHED") return runSummary(run);
  if(run.mode==="WEEKLY") {
    if(!run.weekly || run.weekly.status!=="SCHEDULED" ||
      run.weekly.weekEnd <= new Date()) fail(410,"week_closed","이번 주 챌린지가 종료됐어요");
  }
  let round=await db().playRunQuestion.findUnique({where:{runId_position:{runId:run.id,position:run.currentIndex}}});
  if(!round && run.mode==="INFINITE") {
    const old=await db().playRunQuestion.findMany({where:{runId:run.id},orderBy:{position:"desc"},
      take:30,select:{quizId:true}});
    const chosen=(await randomChoices(run.lane as Lane,1,old.map(o=>o.quizId)))[0];
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
  const revision=await db().quizRevision.findUnique({where:{id:round.revisionId}});
  if(!revision || !(revision.clues as unknown[]).length)
    fail(409,"invalid_question","The pinned question version is unavailable");
  if(!await pinnedMediaApproved([revision]))
    fail(409,"question_suspended","This pinned question contains unapproved or restricted media");
  const token=sessionToken(p.runToken,run.id,run.currentIndex);
  let session=await db().playSession.findUnique({where:{runId_roundIndex:{runId:run.id,roundIndex:run.currentIndex}}});
  if(!session) {
    try {
      session=await db().playSession.create({data:{
        quizId:round.quizId,revisionId:round.revisionId,userId:run.userId,
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
  return {...runSummary(run),sessionId:session.id,sessionToken:token,
    round:run.currentIndex+1,quizId:round.quizId,quizVersion:revision.version,
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
    WHERE pr."weeklyId"=${edition.id} AND pr."mode"='WEEKLY' AND pr."status"='FINISHED'
      AND u."leaderboardEligible"=TRUE AND u."leaderboardOptIn"=TRUE
      AND pr."userId" <> ${edition.hostId}
    ORDER BY pr."score" DESC, pr."completedAt" ASC
    LIMIT ${p.limit} OFFSET ${p.offset}
  `;
  let total=rows[0]?.total ?? 0;
  if(!rows.length && p.offset>0) {
    const fallback=await db().$queryRaw<Array<{total:number}>>`
      SELECT COUNT(*)::INTEGER AS "total" FROM "PlayRun" pr
      JOIN "User" u ON u."id"=pr."userId"
      WHERE pr."weeklyId"=${edition.id} AND pr."mode"='WEEKLY' AND pr."status"='FINISHED'
        AND u."leaderboardEligible"=TRUE AND u."leaderboardOptIn"=TRUE
        AND pr."userId" <> ${edition.hostId}
    `;
    total=fallback[0]?.total??0;
  }
  return {challengeId:edition.id,
    items:rows.map(row=>({rank:row.rank,displayName:row.displayName,score:row.score,solved:row.solved})),
    total,rankingBasis:"first official attempt; verified opt-in adult accounts only; score ties share rank"};
}
