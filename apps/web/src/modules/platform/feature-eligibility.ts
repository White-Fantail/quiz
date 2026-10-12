import { db } from "./db";
import { fail } from "./auth";
import { playableQuizWhere } from "./content-locale";
import type { Locale } from "../../i18n/core";

export type AudienceLane = "GENERAL"|"KIDS";
export type KidAgeBand = "EARLY"|"MIDDLE"|"OLDER";
type SafeRevision={id:string;quizId:string;title:string;clues:unknown;promptMediaIds:unknown};
type ContentTarget={id:string;type:"QUIZ"|"PACK";title:string;description:string;
  creator:string;questionCount:number;orderMode?:string};
export type SafePack=ContentTarget & {packVersion:number;originalQuestionCount:number;excludedCount:number;items:{quizId:string;revisionId:string}[]};

function mediaReferences(revisions:SafeRevision[]){
  const ids=new Set<string>();
  for(const revision of revisions){
    for(const m of Array.isArray(revision.promptMediaIds)?revision.promptMediaIds:[])
      if(typeof m==="string")ids.add(m);
    for(const clue of Array.isArray(revision.clues)?revision.clues:[])
      if(clue&&typeof clue==="object"&&"mediaId" in clue&&typeof clue.mediaId==="string")ids.add(clue.mediaId);
  }
  return [...ids];
}
async function approvedMedia(revisions:SafeRevision[]):Promise<boolean>{
  const ids=mediaReferences(revisions);
  if(!ids.length)return true;
  const count=await db().mediaAsset.count({where:{id:{in:ids},
    status:"READY",moderationStatus:"APPROVED",deletedAt:null}});
  return count===ids.length;
}
function ageEligible(value:unknown,band?:KidAgeBand){
  if(!band)return true;
  const age=band==="EARLY"?6:band==="MIDDLE"?9:12;
  if(!value||typeof value!=="object")return true;
  const range=(value as {ageRange?:{minimum?:number;maximum?:number}}).ageRange;
  if(!range)return true;
  return !(typeof range.minimum==="number"&&age<range.minimum ||
    typeof range.maximum==="number"&&age>range.maximum);
}
/** Revalidate publication, localization, safety, age and EVERY asset. No fallback
 * to another language, no feature/editorial or creator authority can override this.
 */
export async function safePack(id:string,locale:Locale,lane:AudienceLane,
  options:{skipPackApproval?:boolean;ageBand?:KidAgeBand}={}):Promise<SafePack> {
  const pack=await db().quizPack.findFirst({
    where:{id,publication:"PUBLISHED",safetyStatus:{not:"RESTRICTED"},
      localizations:{some:{locale,status:"PUBLISHED"}},
      ...(lane==="KIDS"&&!options.skipPackApproval?
        {kidsEligible:true,kidsReviewStatus:"APPROVED",sourceLocale:locale}:{})},
    select:{id:true,title:true,sourceLocale:true,currentVersion:true,orderMode:true,
      author:{select:{displayName:true}},
      localizations:{where:{locale,status:"PUBLISHED"},select:{title:true,description:true}},
      items:{orderBy:{position:"asc"},select:{quizId:true}}}
  });
  if(!pack||!pack.localizations[0]||!pack.items.length||pack.items.length>100)
    fail(404,"pack_unavailable","Quiz pack is not playable");
  if(lane==="KIDS"&&pack.sourceLocale!==locale)
    fail(404,"kid_pack_locale","Kids packs require approved original-language content");
  const ids=pack.items.map(i=>i.quizId);
  if(new Set(ids).size!==ids.length)
    fail(409,"pack_unavailable","Quiz pack contains duplicate questions");

  // Adult packs may continue after an individual quiz is removed or restricted.
  // Kids require EVERY original-language quiz and approved media, without exception.
  const quizzes=await db().quiz.findMany({where:{id:{in:ids},...playableQuizWhere(locale,lane)},
    select:{id:true,recommendedAudience:true,
      localizations:{where:{locale,status:"PUBLISHED"},
        select:{id:true,origin:true,publishedVersion:true}}}});
  const eligible=quizzes.filter(q=>
    ageEligible(q.recommendedAudience,options.ageBand)&&
    q.localizations.length>0&&q.localizations[0].publishedVersion!==null&&
    (lane!=="KIDS"||["ORIGINAL","LEGACY"].includes(q.localizations[0].origin)));
  if(lane==="KIDS"&&eligible.length!==ids.length)
    fail(409,"pack_unavailable","Every question must be independently approved for Kids");

  const expected=eligible.map(q=>({quizId:q.id,localizationId:q.localizations[0].id,
    version:q.localizations[0].publishedVersion!}));
  const revisions=expected.length?await db().quizRevision.findMany({where:{
    OR:expected.map(x=>({localizationId:x.localizationId,version:x.version}))
  },select:{id:true,quizId:true,title:true,clues:true,promptMediaIds:true}}):[];
  const validRevisions=revisions.filter(r=>Array.isArray(r.clues)&&r.clues.length>0);
  const needed=mediaReferences(validRevisions);
  const existing=needed.length?await db().mediaAsset.findMany({where:{id:{in:needed},
    status:"READY",moderationStatus:"APPROVED",deletedAt:null},select:{id:true}}):[];
  const allowed=new Set(existing.map(m=>m.id));
  const byQuiz=new Map(validRevisions.filter(r=>mediaReferences([r]).every(mid=>allowed.has(mid)))
    .map(r=>[r.quizId,r.id]));
  const items=ids.filter(quizId=>byQuiz.has(quizId))
    .map(quizId=>({quizId,revisionId:byQuiz.get(quizId)!}));
  if(!items.length || (lane==="KIDS"&&items.length!==ids.length))
    fail(409,"pack_unavailable",lane==="KIDS"
      ?"Every question and media asset must be Kids-approved"
      :"This pack has no currently playable questions");

  const loc=pack.localizations[0];
  return {id:pack.id,type:"PACK",title:loc.title,description:loc.description,
    creator:pack.author.displayName,questionCount:items.length,
    originalQuestionCount:ids.length,excludedCount:ids.length-items.length,
    orderMode:pack.orderMode,packVersion:pack.currentVersion,items};
}

export async function safeQuiz(id:string,locale:Locale,lane:AudienceLane,
  ageBand?:KidAgeBand):Promise<ContentTarget> {
  const quiz=await db().quiz.findFirst({where:{
    id,...playableQuizWhere(locale,lane)
  },select:{id:true,author:{select:{displayName:true}},
    recommendedAudience:true,localizations:{where:{locale,status:"PUBLISHED"},
      select:{id:true,publishedVersion:true,origin:true}}}});
  if(!quiz||!quiz.localizations[0]||
    (lane==="KIDS"&&!["ORIGINAL","LEGACY"].includes(quiz.localizations[0].origin))||
    !ageEligible(quiz.recommendedAudience,ageBand))
    fail(404,"quiz_unavailable","Quiz is unavailable for this audience");
  const loc=quiz.localizations[0];
  if(loc.publishedVersion==null)fail(409,"quiz_unavailable","Quiz has no published revision");
  const rev=await db().quizRevision.findUnique({where:{
    localizationId_version:{localizationId:loc.id,version:loc.publishedVersion}
  },select:{id:true,quizId:true,title:true,clues:true,promptMediaIds:true}});
  if(!rev||!Array.isArray(rev.clues)||!rev.clues.length||!await approvedMedia([rev]))
    fail(409,"quiz_unavailable","This quiz has unavailable media");
  return {id:quiz.id,type:"QUIZ",title:rev.title,description:"",
    creator:quiz.author.displayName,questionCount:1};
}
export async function safeFeatureTarget(type:"QUIZ"|"PACK",id:string,locale:Locale,
  lane:AudienceLane,ageBand?:KidAgeBand):Promise<ContentTarget>{
  return type==="PACK"?safePack(id,locale,lane,{ageBand}):safeQuiz(id,locale,lane,ageBand);
}
