import { buildKidAnswerChoices } from "./answer-choices";
import { publicAnswerFormat } from "../platform/answer-options";
import { db } from "../platform/db";
import { execute } from "../platform/operations";
import { fail } from "../platform/auth";
import { getPlaySession,playClue,playGuess } from "../platform/play";
import { runCurrent } from "../platform/runs";
import { signedPlayMedia } from "../platform/media";
import type { Actor } from "../platform/auth";
import { playableQuizWhere } from "../platform/content-locale";
import { safePack } from "../platform/feature-eligibility";
import type { nativeKidFromHeaders } from "./service";

type Kid = Awaited<ReturnType<typeof nativeKidFromHeaders>>;
type Mode = "RANDOM_FIVE";
const approvedOrigins=["ORIGINAL","LEGACY"];

function owner(kid:Kid){return {profileId:kid.profileId,deviceId:kid.id};}
/** Constructed solely after nativeKidFromHeaders verified the device bearer. */
function childActor(kid:Kid):Actor {
  return {id:"native-child",role:"KID",displayName:"",leaderboardEligible:false,
    leaderboardOptIn:false,childScope:owner(kid)};
}
async function ownedRun(kid:Kid,runId:string) {
  const binding=await db().kidPlayRun.findUnique({where:{runId}});
  if(!binding || binding.profileId!==kid.profileId || binding.deviceId!==kid.id)
    fail(403,"kid_play_forbidden","This run belongs to a different child's device");
  return binding;
}
/** Recheck safety, original language revision and all media BEFORE every protected play action. */
async function ownedSession(kid:Kid,sessionId:string,sessionToken:string){
  const entry=await db().playSession.findUnique({where:{id:sessionId},
    include:{quiz:true,run:{select:{packId:true}},revision:{include:{localization:true}}}});
  if(!entry)fail(404,"kid_play_missing","Game session not found");
  if(entry.runId){
    await ownedRun(kid,entry.runId);
    const packRun=await db().playRun.findUnique({where:{id:entry.runId},
      select:{mode:true,lane:true,packId:true}});
    if(packRun?.mode==="PACK"){
      if(packRun.lane!=="KIDS"||!packRun.packId)
        fail(403,"kid_pack_invalid","This is not an authorized child pack run");
      await safePack(packRun.packId,kid.profile.locale as "en"|"ko","KIDS",
        {ageBand:kid.profile.ageBand as "EARLY"|"MIDDLE"|"OLDER"});
    }
  }
  else {
    const link=await db().kidPlaySingle.findUnique({where:{sessionId}});
    if(!link || link.profileId!==kid.profileId || link.deviceId!==kid.id)
      fail(403,"kid_play_forbidden","Quiz belongs to a different child's device");
  }
  if(entry.locale!==kid.profile.locale || entry.quiz.publication!=="PUBLISHED" ||
    (entry.quiz.safetyStatus==="RESTRICTED" || !entry.quiz.kidsEligible ||
      entry.quiz.kidsReviewStatus!=="APPROVED") ||
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
  await getPlaySession({sessionId,sessionToken},childActor(kid));
  return entry;
}
async function answerChoices(kid:Kid,sessionId:string,sessionToken:string){
  const active=await ownedSession(kid,sessionId,sessionToken);
  const authorChoices=publicAnswerFormat(active.revision.answer,sessionId);
  if(authorChoices.responseMode==="multiple-choice")return authorChoices.options ?? [];
  if(kid.profile.ageBand==="OLDER")return [];
  if(active.status!=="ACTIVE")return [];
  const revisions=await db().quizRevision.findMany({
    where:{answerType:active.revision.answerType,
      localization:{is:{locale:kid.profile.locale,status:"PUBLISHED",
        origin:{in:approvedOrigins},quiz:{is:playableQuizWhere(kid.profile.locale as "en"|"ko","KIDS")}}}},
    select:{quizId:true,answer:true,version:true,localization:{select:{publishedVersion:true}}},
    orderBy:{id:"asc"},take:120
  });
  const preferredQuizIds=new Set<string>();
  if(active.run?.packId){
    const siblings=await db().packQuestion.findMany({
      where:{packId:active.run.packId},select:{quizId:true}
    });
    for(const sibling of siblings)preferredQuizIds.add(sibling.quizId);
  }
  return buildKidAnswerChoices({
    sessionId,runId:active.runId,roundIndex:active.roundIndex,
    answer:active.revision.answer,
    candidates:revisions.filter(revision=>revision.quizId!==active.quizId &&
      revision.localization?.publishedVersion===revision.version),
    preferredQuizIds,minDecoys:kid.profile.ageBand==="EARLY"?1:2
  });
}
export async function startKidRun(kid:Kid,mode:Mode,avoidQuizIds:string[]=[]){
  // Use the shared published question bank, but exclude this child's previously
  // allocated and played quizzes across devices (up to the existing 1,000-ID cap).
  let avoid=avoidQuizIds;
  if(mode==="RANDOM_FIVE"){
    const [seen,allocated]=await Promise.all([
      db().playSession.findMany({where:{OR:[
        {run:{is:{kidOwnership:{is:{profileId:kid.profileId}}}}},
        {kidSingle:{is:{profileId:kid.profileId}}}
      ]},select:{quizId:true},orderBy:{startedAt:"desc"},take:1000}),
      db().playRunQuestion.findMany({where:{run:{is:{kidOwnership:{is:{profileId:kid.profileId}}}}},
        select:{quizId:true},take:1000})
    ]);
    avoid=[...new Set([...avoidQuizIds,...seen.map(x=>x.quizId),...allocated.map(x=>x.quizId)])].slice(0,1000);
  }
  const p={mode,lane:"KIDS",locale:kid.profile.locale,avoidQuizIds:avoid};
  const run=await execute("run_start",p,null) as any;
  if(run?.lane!=="KIDS" || run?.locale!==kid.profile.locale || !run?.runId || !run?.runToken)
    fail(409,"kid_run_invalid","Game session was not created safely");
  await db().kidPlayRun.create({data:{runId:run.runId,...owner(kid)}});
  return {...run,official:false};
}
export async function startKidSingle(kid:Kid,quizId:string){
  const locale=kid.profile.locale as "en"|"ko";
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
  const reference=await db().playRun.findUnique({where:{id:runId},
    select:{mode:true,lane:true,packId:true}});
  if(reference?.mode==="PACK"){
    if(reference.lane!=="KIDS"||!reference.packId)
      fail(403,"kid_pack_invalid","Pack play must belong to the Kids lane");
    await safePack(reference.packId,kid.profile.locale as "en"|"ko","KIDS",
      {ageBand:kid.profile.ageBand as "EARLY"|"MIDDLE"|"OLDER"});
  }
  const result=await runCurrent({runId,runToken,locale:kid.profile.locale,avoidQuizIds:[]},childActor(kid)) as any;
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
    ...publicAnswerFormat(session.revision.answer,sessionId),
    options:await answerChoices(kid,sessionId,sessionToken),
    ...(session.status!=="ACTIVE"?{scoreThisQuestion:session.score}:{})};
}
export async function kidClue(kid:Kid,sessionId:string,sessionToken:string){
  await ownedSession(kid,sessionId,sessionToken);
  return playClue({sessionId,sessionToken},childActor(kid));
}
export async function kidGuess(kid:Kid,sessionId:string,sessionToken:string,guess:string){
  await ownedSession(kid,sessionId,sessionToken);
  return playGuess({sessionId,sessionToken,guess},childActor(kid));
}
export async function kidMedia(kid:Kid,sessionId:string,sessionToken:string,mediaId:string){
  await ownedSession(kid,sessionId,sessionToken);
  return signedPlayMedia({sessionId,sessionToken,mediaId},childActor(kid));
}
/** Private progress only; never return an adult identity, public leaderboard or an answer key. */
export async function kidTreasures(kid:Kid){
  const profileId=kid.profileId;
  const own={OR:[
    {run:{is:{kidOwnership:{is:{profileId}}}}},
    {kidSingle:{is:{profileId}}}
  ]};
  const safe={quiz:{is:{publication:"PUBLISHED",safetyStatus:{not:"RESTRICTED"},kidsEligible:true,kidsReviewStatus:"APPROVED"}},
    revision:{is:{localization:{is:{
      locale:kid.profile.locale,status:"PUBLISHED",origin:{in:approvedOrigins}
    }}}}};
  const [solved,completed,latest,uniqueSolved]=await Promise.all([
    db().playSession.count({where:{...own,status:"SOLVED"}}),
    db().playSession.count({where:{...own,status:{in:["SOLVED","FAILED"]}}}),
    db().playSession.findMany({where:{...own,...safe,status:"SOLVED"},
      orderBy:{finishedAt:"desc"},take:60,
      select:{quizId:true,score:true,finishedAt:true,revision:{select:{
        title:true,version:true,localization:{select:{publishedVersion:true}}
      }}}}),
    db().playSession.findMany({where:{...own,status:"SOLVED"},select:{quizId:true},
      distinct:["quizId"],take:10})
  ]);
  const seen=new Set<string>();
  const discoveries=latest.filter(s=>{
    if(s.revision.localization?.publishedVersion!==s.revision.version || seen.has(s.quizId))return false;
    seen.add(s.quizId);return true;
  })
    .slice(0,20).map(s=>({quizId:s.quizId,title:s.revision.title,score:s.score,at:s.finishedAt}));
  const badges=[
    {id:"first",required:1,label:"First discovery",emoji:"🌟"},
    {id:"five",required:5,label:"Curious explorer",emoji:"🧭"},
    {id:"ten",required:10,label:"Treasure hunter",emoji:"🏆"}
  ].filter(x=>uniqueSolved.length>=x.required);
  return {solved,completed,discoveries,badges};
}

/** Children can flag ONLY questions assigned or played on their own private profile.
 * No comment box to accidentally collect private child information. */
export async function kidReport(kid:Kid,quizId:string,reason:"UNSAFE"|"INCORRECT"|"BROKEN_MEDIA"){
  const played=await db().playSession.findFirst({where:{quizId,OR:[
    {run:{is:{kidOwnership:{is:{profileId:kid.profileId}}}}},
    {kidSingle:{is:{profileId:kid.profileId}}}
  ]},select:{id:true}});
  if(!played)fail(403,"kid_report_forbidden","Only your own played questions can be reported");
  await db().kidSafetyReport.upsert({where:{profileId_quizId_reason:{
    profileId:kid.profileId,quizId,reason
  }},create:{profileId:kid.profileId,quizId,reason},update:{}});
  return {reported:true};
}
