import { db } from "./db";
import { fail,requireActor,type Actor } from "./auth";
import type { Locale } from "../../i18n/core";
import { safeFeatureTarget,safePack,type AudienceLane,type KidAgeBand } from "./feature-eligibility";
type FeatureTarget="QUIZ"|"PACK";
type FeaturePreview={id:string;type:FeatureTarget;title:string;description:string;
  creator:string;questionCount:number;orderMode?:string};

function admin(actor:Actor|null){
  const user=requireActor(actor);
  if(user.role!=="ADMIN"||user.childScope)fail(403,"admin_required","Only platform administrators can curate content");
  return user;
}
function validWindow(startAt:Date,endAt:Date){
  if(!Number.isFinite(startAt.getTime())||!Number.isFinite(endAt.getTime())||
    endAt<=startAt||endAt.getTime()-startAt.getTime()>365*86400000)
    fail(400,"invalid_feature_window","Choose a positive scheduling window under one year");
}
/** Creator credentials require a separate verified identity workflow. All editorial
 * placements use the literal Editor's Pick label, regardless of creator popularity.
 */
export async function editorialFeaturesList(p:Record<string,any>,_actor:Actor|null){
  if(p.lane!=="GENERAL")fail(403,"native_kids_only","Kids picks require an authorized native device");
  return scheduledFeatures("GENERAL",p.locale,p.limit??12);
}
export async function scheduledFeatures(lane:AudienceLane,locale:Locale,limit=12,
  ageBand?:KidAgeBand){
  const now=new Date();
  const rows=await db().editorialFeature.findMany({where:{
    lane,locale,status:"ACTIVE",startAt:{lte:now},endAt:{gt:now}
  },orderBy:[{placement:"asc"},{priority:"desc"},{createdAt:"desc"}],take:Math.min(60,limit*4)});
  const candidates=await Promise.all(rows.map(async row=>{
    try{
      const info=await safeFeatureTarget(row.targetType as FeatureTarget,
        (row.targetType==="PACK"?row.packId:row.quizId)!,locale,lane,ageBand);
      return {...info,featureId:row.id,placement:row.placement,priority:row.priority,
        headline:row.headline||info.title,editorialDescription:row.description,
        label:"Editor's Pick",startAt:row.startAt,endAt:row.endAt};
    }catch{return null;}
  }));
  const items=candidates.filter((x):x is NonNullable<typeof x>=>x!==null).slice(0,limit);
  return {lane,locale,items,
    note:"Manual editorial recommendations, not measured popularity or identity verification"};
}
export async function adminFeatureList(p:Record<string,any>,actor:Actor|null){
  admin(actor);
  const where={...(p.locale?{locale:p.locale}:{}),
    ...(p.lane?{lane:p.lane}:{}),
    ...(p.status?{status:p.status}:{})};
  const [rows,count]=await Promise.all([
    db().editorialFeature.findMany({where,orderBy:[{createdAt:"desc"},{id:"desc"}],
      skip:p.offset,take:p.limit}),
    db().editorialFeature.count({where})
  ]);
  return {items:rows.map(r=>({...r,subjectId:r.quizId??r.packId})),count};
}
export async function adminFeatureCandidates(p:Record<string,any>,actor:Actor|null){
  admin(actor);
  const locale=p.locale as Locale,lane=p.lane as AudienceLane;
  const candidates:Array<{id:string;type:FeatureTarget}>=[];
  if(p.type==="QUIZ"){
    const rows=await db().quizRevision.findMany({where:{
      title:{contains:p.search??"",mode:"insensitive"},
      localization:{locale,status:"PUBLISHED",quiz:{publication:"PUBLISHED"}}
    },select:{quizId:true},take:35,orderBy:{createdAt:"desc"}});
    for(const r of rows)candidates.push({id:r.quizId,type:"QUIZ"});
  }else{
    const rows=await db().quizPack.findMany({where:{publication:"PUBLISHED",
      localizations:{some:{locale,status:"PUBLISHED",
        title:{contains:p.search??"",mode:"insensitive"}}}},
      select:{id:true},take:35,orderBy:{updatedAt:"desc"}});
    for(const r of rows)candidates.push({id:r.id,type:"PACK"});
  }
  const seen=new Set<string>();
  const unique=candidates.filter(r=>!seen.has(r.id)&&(seen.add(r.id),true));
  const eligible=await Promise.all(unique.map(async ({id,type})=>{
    try{return await safeFeatureTarget(type,id,locale,lane) as FeaturePreview;}
    catch{return null;}
  }));
  return {items:eligible.filter((v):v is FeaturePreview=>v!==null).slice(0,p.limit),
    locale,lane};
}
export async function adminFeatureCreate(p:Record<string,any>,actor:Actor|null){
  const user=admin(actor);
  const startAt=new Date(p.startAt),endAt=new Date(p.endAt);
  validWindow(startAt,endAt);
  await safeFeatureTarget(p.targetType,p.targetId,p.locale,p.lane);
  const feature=await db().$transaction(async tx=>{
    const r=await tx.editorialFeature.create({data:{
      targetType:p.targetType,...(p.targetType==="QUIZ"?{quizId:p.targetId}:{packId:p.targetId}),
      lane:p.lane,locale:p.locale,placement:p.placement,priority:p.priority,
      headline:p.headline,description:p.description,startAt,endAt,
      status:"ACTIVE",createdById:user.id
    }});
    await tx.auditLog.create({data:{actorId:user.id,objectId:r.id,action:"editorial.create",
      detail:{targetType:p.targetType,targetId:p.targetId,lane:p.lane,locale:p.locale,
        startAt:p.startAt,endAt:p.endAt}}});
    return r;
  });
  return {id:feature.id,status:feature.status,scheduled:true,label:"Editor's Pick"};
}
export async function adminFeatureUpdate(p:Record<string,any>,actor:Actor|null){
  const user=admin(actor);
  const old=await db().editorialFeature.findUnique({where:{id:p.id}});
  if(!old)fail(404,"not_found","Editorial placement not found");
  const startAt=p.startAt?new Date(p.startAt):old.startAt,
    endAt=p.endAt?new Date(p.endAt):old.endAt;
  validWindow(startAt,endAt);
  if(p.status==="ACTIVE"){
    await safeFeatureTarget(old.targetType as FeatureTarget,(old.quizId??old.packId)!,
      old.locale as Locale,old.lane as AudienceLane);
  }
  const feature=await db().$transaction(async tx=>{
    const changed=await tx.editorialFeature.updateMany({
      where:{id:old.id,updatedAt:old.updatedAt},data:{
        ...(p.status?{status:p.status}:{}),
        ...(p.placement?{placement:p.placement}:{}),
        ...(p.priority!==undefined?{priority:p.priority}:{}),
        ...(p.headline!==undefined?{headline:p.headline}:{}),
        ...(p.description!==undefined?{description:p.description}:{}),
        startAt,endAt
      }});
    if(changed.count!==1)fail(409,"feature_conflict","Placement changed; refresh and retry");
    await tx.auditLog.create({data:{actorId:user.id,objectId:old.id,action:"editorial.update",
      detail:{status:p.status,placement:p.placement,priority:p.priority,
        startAt:startAt.toISOString(),endAt:endAt.toISOString()}}});
    return tx.editorialFeature.findUniqueOrThrow({where:{id:old.id}});
  });
  return {id:feature.id,status:feature.status,updatedAt:feature.updatedAt};
}
export async function adminFeatureRemove(p:Record<string,any>,actor:Actor|null){
  const user=admin(actor);
  if(!p.confirm)fail(400,"confirmation_required","Confirm removal");
  return db().$transaction(async tx=>{
    const old=await tx.editorialFeature.findUnique({where:{id:p.id}});
    if(!old)fail(404,"not_found","Editorial placement not found");
    await tx.editorialFeature.delete({where:{id:p.id}});
    await tx.auditLog.create({data:{actorId:user.id,objectId:old.id,action:"editorial.remove",
      detail:{targetType:old.targetType,subjectId:old.quizId??old.packId}}});
    return {removed:true,id:old.id};
  });
}

/** Kids safety review is independent of creator publication and editor placement. */
export async function adminPackSafetyList(p:Record<string,any>,actor:Actor|null){
  admin(actor);
  const rows=await db().quizPack.findMany({where:{publication:"PUBLISHED"},
    orderBy:[{updatedAt:"desc"},{id:"desc"}],skip:p.offset,take:p.limit,
    select:{id:true,title:true,sourceLocale:true,currentVersion:true,orderMode:true,
      safetyStatus:true,kidsEligible:true,items:{select:{quizId:true}}}});
  const checked=await Promise.all(rows.map(async pack=>{
    const locale=pack.sourceLocale;
    let ready=false,issue="";
    if(locale!=="en"&&locale!=="ko")issue="Original language has not been classified";
    else try{
      await safePack(pack.id,locale,"KIDS",{skipPackApproval:true});ready=true;
    }catch(e){issue=e instanceof Error?e.message:"Safety check failed";}
    return {id:pack.id,title:pack.title,sourceLocale:locale,
      currentVersion:pack.currentVersion,safetyStatus:pack.safetyStatus,
      kidsEligible:pack.kidsEligible,questionCount:pack.items.length,ready,issue};
  }));
  return {items:checked,offset:p.offset,limit:p.limit};
}
export async function adminPackSafetyReview(p:Record<string,any>,actor:Actor|null){
  const user=admin(actor);
  const pack=await db().quizPack.findFirst({where:{id:p.id,publication:"PUBLISHED"}});
  if(!pack)fail(404,"not_found","Published pack not found");
  if(p.expectedVersion!==pack.currentVersion)
    fail(409,"pack_conflict","Pack changed; inspect the latest version");
  if(p.verdict==="APPROVED"){
    if(pack.safetyStatus==="RESTRICTED")
      fail(409,"restricted_pack","Restore to pending before reapproving");
    if(pack.sourceLocale!=="en"&&pack.sourceLocale!=="ko")
      fail(409,"pack_locale_unclassified","An original language is required");
    await safePack(pack.id,pack.sourceLocale,"KIDS",{skipPackApproval:true});
  }
  const updated=await db().$transaction(async tx=>{
    const changed=await tx.quizPack.updateMany({where:{
      id:pack.id,currentVersion:pack.currentVersion,updatedAt:pack.updatedAt,
      publication:"PUBLISHED"
    },data:{safetyStatus:p.verdict,kidsEligible:p.verdict==="APPROVED"}});
    if(changed.count!==1)fail(409,"pack_conflict","Pack changed; inspect the latest version");
    await tx.auditLog.create({data:{actorId:user.id,objectId:pack.id,action:"pack.kids_safety.review",
      detail:{verdict:p.verdict,reason:p.reason,packVersion:pack.currentVersion,
        sourceLocale:pack.sourceLocale}}});
    return {id:pack.id,verdict:p.verdict,kidsEligible:p.verdict==="APPROVED"};
  });
  return updated;
}
