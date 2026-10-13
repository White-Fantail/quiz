import { db } from "./db";
import { fail, requireActor, type Actor } from "./auth";

type TargetKind="QUIZ"|"PACK"|"PUBLISHER";
function admin(actor:Actor|null){
  const user=requireActor(actor);
  if(user.role!=="ADMIN"||user.childScope) fail(403,"admin_required","Only administrators may review appeals and reports");
  return user;
}
async function ensureAppealable(tx:any,user:Actor,kind:TargetKind,id:string){
  if(kind==="PUBLISHER"){
    if(id!==user.id)fail(403,"not_owner","You cannot appeal another account's restriction");
    const account=await tx.user.findUnique({where:{id}});
    if(!account||account.publishingStatus!=="RESTRICTED"||
      (account.publishingRestrictedUntil&&account.publishingRestrictedUntil<=new Date()))
      fail(409,"appeal_unavailable","Your publishing access is not currently restricted");
    return;
  }
  const target=kind==="QUIZ"?await tx.quiz.findUnique({where:{id}}):await tx.quizPack.findUnique({where:{id}});
  if(!target||target.authorId!==user.id)fail(404,"not_found","Only the creator may appeal this content");
  if(!["UNDER_REVIEW","RESTRICTED"].includes(target.safetyStatus))
    fail(409,"appeal_unavailable","Only held or staff-restricted content can be appealed");
}
export async function myModerationInbox(p:Record<string,any>,actor:Actor|null){
  const user=requireActor(actor);
  if(user.childScope)fail(403,"child_access_forbidden","Guardian accounts manage moderation");
  const [notices,appeals,profile]=await Promise.all([
    db().moderationNotice.findMany({where:{userId:user.id},orderBy:{createdAt:"desc"},
      take:p.limit,skip:p.offset,select:{id:true,targetKind:true,targetId:true,event:true,message:true,createdAt:true,readAt:true}}),
    db().moderationAppeal.findMany({where:{userId:user.id},orderBy:{createdAt:"desc"},
      take:50,select:{id:true,targetKind:true,targetId:true,status:true,message:true,resolution:true,createdAt:true,reviewedAt:true}}),
    db().user.findUnique({where:{id:user.id},select:{publishingStatus:true,publishingRestrictedUntil:true}})
  ]);
  return {notices,appeals,publishing:profile};
}
export async function myModerationRead(p:Record<string,any>,actor:Actor|null){
  const user=requireActor(actor);
  const changed=await db().moderationNotice.updateMany({where:{id:p.id,userId:user.id,readAt:null},data:{readAt:new Date()}});
  return {read:changed.count>0};
}
export async function myModerationAppeal(p:Record<string,any>,actor:Actor|null){
  const user=requireActor(actor);
  if(user.childScope)fail(403,"child_access_forbidden","Kids cannot file an adult appeal");
  const kind=p.kind as TargetKind,id=p.targetId as string;
  return db().$transaction(async tx=>{
    // Acquire a row lock so multiple requests cannot submit concurrent OPEN appeals.
    if(kind==="QUIZ")await tx.$queryRaw`SELECT "id" FROM "Quiz" WHERE "id"=${id} FOR UPDATE`;
    else if(kind==="PACK")await tx.$queryRaw`SELECT "id" FROM "QuizPack" WHERE "id"=${id} FOR UPDATE`;
    else await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${id} FOR UPDATE`;
    await ensureAppealable(tx,user,kind,id);
    const prior=await tx.moderationAppeal.findFirst({where:{userId:user.id,targetKind:kind,targetId:id,status:"OPEN"}});
    if(prior)fail(409,"appeal_pending","An appeal for this item is already pending");
    const since=new Date(Date.now()-86400000);
    const count=await tx.moderationAppeal.count({where:{userId:user.id,createdAt:{gte:since}}});
    if(count>=5)fail(429,"appeal_rate_limit","Too many appeals submitted today");
    const appeal=await tx.moderationAppeal.create({data:{userId:user.id,targetKind:kind,targetId:id,message:p.message}});
    await tx.auditLog.create({data:{actorId:user.id,action:"moderation.appeal.created",objectId:id,
      detail:{appealId:appeal.id,targetKind:kind}}});
    return {id:appeal.id,status:appeal.status,createdAt:appeal.createdAt};
  });
}
export async function adminModerationDetail(p:Record<string,any>,actor:Actor|null){
  admin(actor);
  const kind=p.kind as "QUIZ"|"PACK",id=p.id as string;
  const target=kind==="QUIZ"?await db().quiz.findUnique({where:{id},select:{id:true,authorId:true,publication:true,safetyStatus:true}}):
    await db().quizPack.findUnique({where:{id},select:{id:true,authorId:true,publication:true,safetyStatus:true}});
  if(!target)fail(404,"not_found","Content not found");
  const [reports,history,appeals]=await Promise.all([
    kind==="QUIZ"?db().report.findMany({where:{quizId:id},orderBy:{createdAt:"desc"},take:50,
      select:{id:true,reason:true,detail:true,createdAt:true,status:true,locale:true}}):
      db().packReport.findMany({where:{packId:id},orderBy:{createdAt:"desc"},take:50,
        select:{id:true,reason:true,detail:true,createdAt:true,status:true,locale:true}}),
    db().auditLog.findMany({where:{objectId:id,action:{in:["quiz.auto_hold","pack.auto_hold",
      "quiz.moderation_review","pack.moderation_review","quiz.review","pack.general.moderation"]}},
      orderBy:{createdAt:"desc"},take:25,select:{action:true,createdAt:true,detail:true}}),
    db().moderationAppeal.findMany({where:{targetKind:kind,targetId:id},
      orderBy:{createdAt:"desc"},take:15,select:{id:true,status:true,message:true,resolution:true,createdAt:true}})
  ]);
  return {...target,kind,reports,history,appeals};
}
export async function adminModerationAppeals(p:Record<string,any>,actor:Actor|null){
  admin(actor);
  const where=p.status==="ALL"?{}:{status:p.status};
  const [items,total]=await Promise.all([
    db().moderationAppeal.findMany({where,orderBy:{createdAt:"asc"},skip:p.offset,take:p.limit,
      select:{id:true,userId:true,targetKind:true,targetId:true,message:true,status:true,
        createdAt:true,reviewedAt:true,resolution:true,user:{select:{displayName:true}}}}),
    db().moderationAppeal.count({where})
  ]);
  return {items:items.map(item=>({...item,creator:item.user.displayName,user:undefined})),total};
}
export async function adminModerationAppealReview(p:Record<string,any>,actor:Actor|null){
  const reviewer=admin(actor);
  return db().$transaction(async tx=>{
    const appeal=await tx.moderationAppeal.findUnique({where:{id:p.id}});
    if(!appeal)fail(404,"not_found","Appeal not found");
    if(appeal.status!=="OPEN")fail(409,"appeal_resolved","Appeal was already reviewed");
    if(p.decision==="ACCEPTED"){
      if(appeal.targetKind==="PUBLISHER"){
        const person=await tx.user.findUnique({where:{id:appeal.targetId}});
        if(person?.publishingStatus==="RESTRICTED")
          await tx.user.updateMany({where:{id:appeal.targetId,publishingStatus:"RESTRICTED"},
            data:{publishingStatus:"ACTIVE",publishingRestrictedUntil:null}});
      }else if(appeal.targetKind==="QUIZ"){
        await tx.quiz.updateMany({where:{id:appeal.targetId,authorId:appeal.userId,
          safetyStatus:{in:["UNDER_REVIEW","RESTRICTED"]}},
          data:{safetyStatus:"ACTIVE",moderationReviewedAt:new Date()}});
        await tx.report.updateMany({where:{quizId:appeal.targetId,status:"OPEN"},data:{status:"CLOSED"}});
      }else if(appeal.targetKind==="PACK"){
        await tx.quizPack.updateMany({where:{id:appeal.targetId,authorId:appeal.userId,
          safetyStatus:{in:["UNDER_REVIEW","RESTRICTED"]}},data:{safetyStatus:"ACTIVE"}});
        await tx.packReport.updateMany({where:{packId:appeal.targetId,status:"OPEN"},data:{status:"CLOSED"}});
      }
    }
    const updated=await tx.moderationAppeal.updateMany({where:{id:appeal.id,status:"OPEN"},
      data:{status:p.decision,resolution:p.reason,reviewedById:reviewer.id,reviewedAt:new Date()}});
    if(updated.count!==1)fail(409,"appeal_conflict","Appeal already handled");
    await tx.auditLog.create({data:{actorId:reviewer.id,action:"moderation.appeal.reviewed",
      objectId:appeal.targetId,detail:{appealId:appeal.id,decision:p.decision,reason:p.reason,targetKind:appeal.targetKind}}});
    await tx.moderationNotice.create({data:{userId:appeal.userId,targetKind:appeal.targetKind,
      targetId:appeal.targetId,event:"APPEAL_"+p.decision,
      message:p.decision==="ACCEPTED"?"Your appeal was accepted. "+p.reason:"Your appeal was declined. "+p.reason}});
    return {id:appeal.id,status:p.decision};
  });
}
