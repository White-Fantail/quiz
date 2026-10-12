import {createHash,randomBytes,randomUUID} from "node:crypto";
import { db } from "../platform/db";
import { fail } from "../platform/auth";
import { orderPackQuestions } from "../platform/pack-order";
import { safePack } from "../platform/feature-eligibility";
import { scheduledFeatures } from "../platform/editorial";
import type {nativeKidFromHeaders} from "./service";

type Kid=Awaited<ReturnType<typeof nativeKidFromHeaders>>;
const localeOf=(kid:Kid)=>kid.profile.locale as "en"|"ko";
const ageOf=(kid:Kid)=>kid.profile.ageBand as "EARLY"|"MIDDLE"|"OLDER";

/** Private device-scoped collection: no adult cookie, analytics, review or
 * leaderboard IDs. Only fully approved original-language packs are returned.
 */
export async function kidPacksCatalog(kid:Kid,offset:number,limit:number) {
  const locale=localeOf(kid);
  const packs=await db().quizPack.findMany({
    where:{publication:"PUBLISHED",sourceLocale:locale,
      kidsEligible:true,safetyStatus:"APPROVED",
      localizations:{some:{locale,status:"PUBLISHED"}},
      items:{some:{}}},
    orderBy:[{updatedAt:"desc"},{id:"desc"}],
    skip:offset,take:Math.min(29,limit+1),select:{id:true}
  });
  const checked=await Promise.all(packs.map(async row=>{
    try{
      const pack=await safePack(row.id,locale,"KIDS",{ageBand:ageOf(kid)});
      return {id:pack.id,title:pack.title,description:pack.description,
        questionCount:pack.questionCount,orderMode:pack.orderMode,kidsEligible:true as const};
    }catch{return null;}
  }));
  const items=checked.filter((x):x is NonNullable<typeof x>=>x!==null);
  return {items:items.slice(0,limit),hasMore:packs.length>limit,locale};
}
export async function kidFeatures(kid:Kid){
  const selected=await scheduledFeatures("KIDS",localeOf(kid),8,ageOf(kid));
  return {items:selected.items.map(item=>({
    id:item.id,type:item.type,title:item.title,
    headline:item.headline,description:item.editorialDescription||item.description,
    creator:item.creator,questionCount:item.questionCount,
    orderMode:item.orderMode,placement:item.placement,label:item.label
  }))};
}

/** A fresh run allocates every question once. The real Kids device binding,
 * immutable revision ids and entire shuffle are saved in one DB transaction.
 */
export async function startKidPack(kid:Kid,packId:string){
  const locale=localeOf(kid);
  const approved=await safePack(packId,locale,"KIDS",{ageBand:ageOf(kid)});
  const token=randomBytes(32).toString("base64url");
  const id=randomUUID();
  const expiresAt=new Date(Math.min(Date.now()+30*86400000,kid.expiresAt.getTime()));
  const data=await db().$transaction(async tx=>{
    // A concurrent creator edit or moderator restriction cannot silently
    // change the reviewed version between approval check and allocation.
    const pack=await tx.quizPack.findFirst({where:{
      id:packId,currentVersion:approved.packVersion,publication:"PUBLISHED",
      sourceLocale:locale,kidsEligible:true,safetyStatus:"APPROVED",
      localizations:{some:{locale,status:"PUBLISHED"}}
    },select:{id:true,currentVersion:true,orderMode:true,
      items:{orderBy:{position:"asc"},select:{quizId:true}}}});
    if(!pack||pack.items.length!==approved.items.length||
      pack.items.some((row,i)=>row.quizId!==approved.items[i].quizId))
      fail(409,"kid_pack_changed","The pack was updated; review is required");
    const ordered=orderPackQuestions(approved.items,pack.orderMode as "CREATOR"|"RANDOM");
    await tx.playRun.create({data:{
      id,mode:"PACK",lane:"KIDS",locale,userId:null,packId:pack.id,
      packVersion:pack.currentVersion,targetCount:ordered.length,
      tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt,
      questions:{create:ordered.map((q,index)=>({
        position:index,quizId:q.quizId,revisionId:q.revisionId
      }))},
      kidOwnership:{create:{profileId:kid.profileId,deviceId:kid.id}}
    }});
    return {runId:id,runToken:token,mode:"PACK" as const,lane:"KIDS" as const,
      locale,status:"ACTIVE",total:ordered.length,completed:0,score:0,
      packId:pack.id,official:false};
  },{isolationLevel:"Serializable"});
  return data;
}
