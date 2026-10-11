import { createHash } from "node:crypto";
import { db } from "../platform/db";
import { execute } from "../platform/operations";
import { fail } from "../platform/auth";
import { getPlaySession } from "../platform/play";
import { playableQuizWhere } from "../platform/content-locale";
import type { nativeKidFromHeaders } from "./service";

type Kid = Awaited<ReturnType<typeof nativeKidFromHeaders>>;
type Mode = "RANDOM_FIVE"|"WEEKLY";
const approvedOrigins=["ORIGINAL","LEGACY"];

function owner(kid:Kid){return {profileId:kid.profileId,deviceId:kid.id};}
async function ownedRun(kid:Kid,runId:string) {
  const binding=await db().kidPlayRun.findUnique({where:{runId}});
  if(!binding || binding.profileId!==kid.profileId || binding.deviceId!==kid.id)
    fail(403,"kid_play_forbidden","This run belongs to a different child's device");
  return binding;
}
/** Recheck safety, original language revision and all media BEFORE every protected play action. */
async function ownedSession(kid:Kid,sessionId:string,sessionToken:string){
  const entry=await db().playSession.findUnique({where:{id:sessionId},
    include:{quiz:true,revision:{include:{localization:true}}}});
  if(!entry)fail(404,"kid_play_missing","Game session not found");
  if(entry.runId)await ownedRun(kid,entry.runId);
  else {
    const link=await db().kidPlaySingle.findUnique({where:{sessionId}});
    if(!link || link.profileId!==kid.profileId || link.deviceId!==kid.id)
      fail(403,"kid_play_forbidden","Quiz belongs to a different child's device");
  }
  if(entry.locale!==kid.profile.locale || entry.quiz.publication!=="PUBLISHED" ||
    entry.quiz.safetyStatus!=="APPROVED" || !entry.quiz.kidsEligible ||
    entry.revision.localization?.status!=="PUBLISHED" ||
    entry.revision.localization.locale!==kid.profile.locale ||
    !approvedOrigins.includes(entry.revision.localization.origin) ||
    entry.revision.localization.publishedVersion!==entry.revision.version)
    fail(409,"kid_content_withdrawn","This question needs another safety review");
  const ids=new Set<string>();
  for(const mediaId of Array.isArray(entry.revision.promptMediaIds)?entry.revision.promptMediaIds:[])
    if(typeof mediaId==="string")ids.add(mediaId);
  for(const clue of Array.isArray(entry.revision.clues)?entry.revision.clues:[])
    if(clue && typeof clue==="object" && "mediaId" in clue && typeof clue.mediaId==="string")
      ids.add(clue.mediaId);
  if(ids.size) {
    const count=await db().mediaAsset.count({where:{id:{in:[...ids]},
      status:"READY",moderationStatus:"APPROVED",deletedAt:null}});
    if(count!==ids.size)fail(409,"kid_media_withdrawn","Media is awaiting approval");
  }
  // Hash and account checks belong to the existing game engine. Never trust session ID alone.
  await getPlaySession({sessionId,sessionToken},null);
  return entry;
}
async function answerChoices(kid:Kid,sessionId:string,sessionToken:string){
  if(kid.profile.ageBand==="OLDER")return [];
  const active=await ownedSession(kid,sessionId,sessionToken);
  if(active.status!=="ACTIVE")return [];
  const correct=String((active.revision.answer as any)?.canonical??"").trim();
  if(!correct)return [];
  const revisions=await db().quizRevision.findMany({
    where:{answerType:active.revision.answerType,
      localization:{is:{locale:kid.profile.locale,status:"PUBLISHED",
        origin:{in:approvedOrigins},quiz:{is:playableQuizWhere(kid.profile.locale,"KIDS")}}}},
    include:{localization:true},take:120
  });
  const distinct=new Set<string>([correct.toLocaleLowerCase()]);
  const decoys:string[]=[];
  for(const revision of revisions){
    if(revision.quizId===active.quizId || revision.localization?.publishedVersion!==revision.version)continue;
    const text=String((revision.answer as any)?.canonical??"").trim();
    if(text && !distinct.has(text.toLocaleLowerCase())){distinct.add(text.toLocaleLowerCase());decoys.push(text);}
  }
  if(decoys.length<3)return [];
  const sorted=(values:string[])=>values.sort((a,b)=>{
    const order=(x:string)=>createHash("sha256").update(sessionId+":"+x).digest("hex");
    return order(a).localeCompare(order(b));
  });
  return sorted([correct,...sorted(decoys).slice(0,3)]);
}
export async function startKidRun(kid:Kid,mode:Mode,avoidQuizIds:string[]=[]){
  const p={mode,lane:"KIDS",locale:kid.profile.locale,avoidQuizIds};
  const run=await execute("run_start",p,null) as any;
  if(run?.lane!=="KIDS" || run?.locale!==kid.profile.locale || !run?.runId || !run?.runToken)
    fail(409,"kid_run_invalid","Game session was not created safely");
  await db().kidPlayRun.create({data:{runId:run.runId,...owner(kid)}});
  return {...run,official:false};
}
export async function startKidSingle(kid:Kid,quizId:string){
  const locale=kid.profile.locale;
  const exists=await db().quiz.findFirst({where:{id:quizId,...playableQuizWhere(locale,"KIDS")}});
  if(!exists)fail(404,"kid_quiz_unavailable","Quiz is not approved for this child language");
  const started=await execute("play_start",{quizId,kids:true,locale},null) as any;
  if(!started?.sessionId || !started?.sessionToken)
    fail(409,"kid_play_invalid","Game was not created safely");
  await db().kidPlaySingle.create({data:{sessionId:started.sessionId,...owner(kid)}});
  // Validate the pinned revision and approved media before returning any clues or prompt.
  await ownedSession(kid,started.sessionId,started.sessionToken);
  return {...started,options:await answerChoices(kid,started.sessionId,started.sessionToken),ratingAccess:null};
}
export async function currentKidRun(kid:Kid,runId:string,runToken:string){
  await ownedRun(kid,runId);
  const result=await execute("run_current",{runId,runToken,locale:kid.profile.locale,avoidQuizIds:[]},null) as any;
  if(result?.lane!=="KIDS" || result?.locale!==kid.profile.locale)
    fail(403,"kid_run_invalid","Mismatched child content lane");
  if(result.sessionId){
    await ownedSession(kid,result.sessionId,result.sessionToken);
    return {...result,options:await answerChoices(kid,result.sessionId,result.sessionToken),
      official:false,ratings:null,ratingAccess:null,myRating:null};
  }
  return {...result,official:false};
}
export async function currentKidSingle(kid:Kid,sessionId:string,sessionToken:string){
  const session=await ownedSession(kid,sessionId,sessionToken);
  const clues=session.revision.clues as Array<Record<string,unknown>>;
  return {sessionId,sessionToken,quizId:session.quizId,locale:kid.profile.locale,
    title:session.revision.title,prompt:session.revision.prompt,
    promptMediaIds:session.revision.promptMediaIds,clues:clues.slice(0,session.usedClues),
    clueIndex:session.usedClues,clueCount:clues.length,sessionStatus:session.status,
    canGuess:session.status==="ACTIVE" && session.wrongGuesses<session.usedClues,
    options:await answerChoices(kid,sessionId,sessionToken),
    ...(session.status!=="ACTIVE"?{scoreThisQuestion:session.score}:{})};
}
export async function kidClue(kid:Kid,sessionId:string,sessionToken:string){
  await ownedSession(kid,sessionId,sessionToken);
  return execute("play_clue",{sessionId,sessionToken},null);
}
export async function kidGuess(kid:Kid,sessionId:string,sessionToken:string,guess:string){
  await ownedSession(kid,sessionId,sessionToken);
  return execute("play_guess",{sessionId,sessionToken,guess},null);
}
export async function kidMedia(kid:Kid,sessionId:string,sessionToken:string,mediaId:string){
  await ownedSession(kid,sessionId,sessionToken);
  return execute("play_media",{sessionId,sessionToken,mediaId},null);
}
/** Private progress only; never return an adult identity, public leaderboard or an answer key. */
export async function kidTreasures(kid:Kid){
  const profileId=kid.profileId;
  const own={OR:[
    {run:{is:{kidOwnership:{is:{profileId}}}}},
    {kidSingle:{is:{profileId}}}
  ]};
  const safe={quiz:{is:{publication:"PUBLISHED",safetyStatus:"APPROVED",kidsEligible:true}},
    revision:{is:{localization:{is:{
      locale:kid.profile.locale,status:"PUBLISHED",origin:{in:approvedOrigins}
    }}}}};
  const [solved,completed,latest]=await Promise.all([
    db().playSession.count({where:{...own,status:"SOLVED"}}),
    db().playSession.count({where:{...own,status:{in:["SOLVED","FAILED"]}}}),
    db().playSession.findMany({where:{...own,...safe,status:"SOLVED"},
      orderBy:{finishedAt:"desc"},take:30,
      select:{quizId:true,score:true,finishedAt:true,revision:{select:{title:true}}}})
  ]);
  const seen=new Set<string>();
  const discoveries=latest.filter(s=>{if(seen.has(s.quizId))return false;seen.add(s.quizId);return true;})
    .slice(0,20).map(s=>({quizId:s.quizId,title:s.revision.title,score:s.score,at:s.finishedAt}));
  const badges=[
    {id:"first",required:1,label:"First discovery",emoji:"🌟"},
    {id:"five",required:5,label:"Curious explorer",emoji:"🧭"},
    {id:"ten",required:10,label:"Treasure hunter",emoji:"🏆"}
  ].filter(x=>solved>=x.required);
  return {solved,completed,discoveries,badges};
}
