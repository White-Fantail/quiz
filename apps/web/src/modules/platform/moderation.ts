import { db } from "./db";
import { fail, requireActor, type Actor } from "./auth";
import { DEFAULT_REPORT_HOLD_POLICY, shouldAutoHold, type ReportHoldPolicy } from "./moderation-rules";

type TargetKind = "QUIZ" | "PACK";
type PolicyRow = ReportHoldPolicy & {id: string; updatedAt: Date; updatedById: string | null};

function staff(actor: Actor | null): Actor {
  const user = requireActor(actor);
  if (user.role !== "ADMIN" || user.childScope)
    fail(403, "admin_required", "Platform moderation requires an administrator");
  return user;
}

export async function requirePublishingPermission(actor: Actor | null) {
  const user = requireActor(actor);
  if(user.childScope)fail(403,"child_publishing_disabled","Child-scoped sessions cannot publish content");
  if (user.role === "ADMIN") return user;
  const account = await db().user.findUnique({where:{id:user.id},
    select:{publishingStatus:true,publishingRestrictedUntil:true}});
  if (!account) fail(401,"invalid_identity","Account not found");
  if (account.publishingStatus !== "RESTRICTED") return user;
  if (account.publishingRestrictedUntil && account.publishingRestrictedUntil <= new Date()) {
    await db().$transaction(async tx=>{
      const updated=await tx.user.updateMany({where:{id:user.id,publishingStatus:"RESTRICTED",
        publishingRestrictedUntil:{lte:new Date()}},data:{publishingStatus:"ACTIVE",publishingRestrictedUntil:null}});
      if(updated.count) await tx.auditLog.create({data:{actorId:user.id,action:"publisher.restriction_expired",objectId:user.id}});
    });
    return user;
  }
  fail(403, "publishing_restricted", "Your publishing access is restricted. Existing content can still be viewed.");
}

/** A row lock held through the publication transaction serializes against ADMIN account restrictions. */
export async function assertPublishingAllowedInTx(tx:any, user:Actor) {
  if(user.childScope)fail(403,"child_publishing_disabled","Child-scoped sessions cannot publish content");
  if (user.role==="ADMIN") return;
  const rows=await tx.$queryRaw`SELECT "publishingStatus","publishingRestrictedUntil" FROM "User" WHERE "id"=${user.id} FOR SHARE` as
    {publishingStatus:string;publishingRestrictedUntil:Date|null}[];
  if(!rows.length)fail(401,"invalid_identity","Account not found");
  if(rows[0].publishingStatus==="RESTRICTED" &&
    (!rows[0].publishingRestrictedUntil || rows[0].publishingRestrictedUntil>new Date()))
    fail(403,"publishing_restricted","This account cannot publish or modify public content");
}

async function notice(tx:any,userId:string,kind:TargetKind|"PUBLISHER",targetId:string,event:string,message:string){
  await tx.moderationNotice.create({data:{userId,targetKind:kind,targetId,event,message}});
}

async function policyRow():Promise<PolicyRow>{
  return db().moderationPolicy.upsert({where:{id:"default"},create:{id:"default"},update:{}}) as Promise<PolicyRow>;
}

export async function moderationPolicyGet(_p:Record<string,unknown>,actor:Actor|null){
  staff(actor);
  return policyRow();
}

export async function moderationPolicyUpdate(p:Record<string,any>,actor:Actor|null){
  const admin=staff(actor);
  if(p.minimumEstablishedReporters>Math.min(p.quizReportThreshold,p.packReportThreshold))
    fail(422,"invalid_policy","Established-reporter minimum cannot exceed either report threshold");
  return db().$transaction(async tx=>{
    const previous=await tx.moderationPolicy.upsert({where:{id:"default"},
      create:{id:"default"},update:{}});
    const row=await tx.moderationPolicy.update({where:{id:"default"},
      data:{enabled:p.enabled,quizReportThreshold:p.quizReportThreshold,
        packReportThreshold:p.packReportThreshold,windowHours:p.windowHours,
        minimumEstablishedReporters:p.minimumEstablishedReporters,
        establishedAccountDays:p.establishedAccountDays,updatedById:admin.id}});
    const held={quizzes:0,packs:0};
    // Re-evaluate current OPEN reports when thresholds/window change. No scheduled task or AI needed.
    // Single transaction ensures staff never sees new rules with stale hold decisions.
    if(row.enabled){
      const since=new Date(Date.now()-row.windowHours*3600000);
      const establishedBefore=new Date(Date.now()-row.establishedAccountDays*86400000);
      const quizCandidates=await tx.$queryRaw`
        SELECT r."quizId" AS "id" FROM "Report" r
        JOIN "Quiz" q ON q."id"=r."quizId"
        JOIN "User" u ON u."id"=r."reporterId"
        WHERE r."status"='OPEN' AND r."createdAt">=${since}
          AND q."publication"='PUBLISHED' AND q."safetyStatus"='ACTIVE'
          AND r."reporterId"<>q."authorId"
        GROUP BY r."quizId"
        HAVING COUNT(DISTINCT r."reporterId")>=${row.quizReportThreshold}
          AND COUNT(DISTINCT CASE WHEN u."createdAt"<=${establishedBefore} THEN r."reporterId" END)>=${row.minimumEstablishedReporters}
      ` as {id:string}[];
      const packCandidates=await tx.$queryRaw`
        SELECT r."packId" AS "id" FROM "PackReport" r
        JOIN "QuizPack" q ON q."id"=r."packId"
        JOIN "User" u ON u."id"=r."reporterId"
        WHERE r."status"='OPEN' AND r."createdAt">=${since}
          AND q."publication"='PUBLISHED' AND q."safetyStatus"='ACTIVE'
          AND r."reporterId"<>q."authorId"
        GROUP BY r."packId"
        HAVING COUNT(DISTINCT r."reporterId")>=${row.packReportThreshold}
          AND COUNT(DISTINCT CASE WHEN u."createdAt"<=${establishedBefore} THEN r."reporterId" END)>=${row.minimumEstablishedReporters}
      ` as {id:string}[];
      for(const candidate of quizCandidates){
        const q=await tx.quiz.findUnique({where:{id:candidate.id},select:{authorId:true}});
        if(!q)continue;
        const changed=await tx.quiz.updateMany({where:{id:candidate.id,safetyStatus:"ACTIVE",publication:"PUBLISHED"},
          data:{safetyStatus:"UNDER_REVIEW"}});
        if(changed.count){
          held.quizzes++;
          await tx.auditLog.create({data:{actorId:admin.id,action:"quiz.auto_hold",objectId:candidate.id,
            detail:{source:"POLICY_UPDATE",policyId:"default"}}});
          await notice(tx,q.authorId,"QUIZ",candidate.id,"UNDER_REVIEW","Quiz temporarily hidden pending staff review");
        }
      }
      for(const candidate of packCandidates){
        const q=await tx.quizPack.findUnique({where:{id:candidate.id},select:{authorId:true}});
        if(!q)continue;
        const changed=await tx.quizPack.updateMany({where:{id:candidate.id,safetyStatus:"ACTIVE",publication:"PUBLISHED"},
          data:{safetyStatus:"UNDER_REVIEW"}});
        if(changed.count){
          held.packs++;
          await tx.auditLog.create({data:{actorId:admin.id,action:"pack.auto_hold",objectId:candidate.id,
            detail:{source:"POLICY_UPDATE",policyId:"default"}}});
          await notice(tx,q.authorId,"PACK",candidate.id,"UNDER_REVIEW","Quiz pack temporarily hidden pending staff review");
        }
      }
    }
    await tx.auditLog.create({data:{actorId:admin.id,action:"moderation.policy_update",objectId:"default",
      detail:{before:JSON.parse(JSON.stringify(previous)),after:p,held}}});
    return {...row,reevaluatedHolds:held};
  });
}

/** Prevent duplicate OPEN reports per reporter and target; serialize per-target decisions.
 * Reporting is available to adults on currently ACTIVE published content only.
 */
export async function submitReport(kind:TargetKind,p:Record<string,any>,actor:Actor|null){
  const user=requireActor(actor);
  if(user.childScope) fail(403,"child_reports_disabled","Child reports use the parent safety flow");
  const id=kind==="QUIZ"?p.quizId:p.id;
  return db().$transaction(async tx=>{
    // Serialize report insert/count/hold decisions for the same target to avoid lost thresholds.
    if(kind==="QUIZ") await tx.$queryRaw`SELECT "id" FROM "Quiz" WHERE "id"=${id} FOR UPDATE`;
    else await tx.$queryRaw`SELECT "id" FROM "QuizPack" WHERE "id"=${id} FOR UPDATE`;
    const item=kind==="QUIZ"
      ?await tx.quiz.findUnique({where:{id}})
      :await tx.quizPack.findUnique({where:{id}});
    if(!item||item.publication!=="PUBLISHED"||item.safetyStatus!=="ACTIVE")
      fail(404,"not_found","Content is not available for reporting");
    if(item.authorId===user.id)fail(403,"own_report","Creators cannot report their own content");
    let publishedVersion:number|null=null;
    if(kind==="QUIZ"){
      const loc=await tx.quizLocalization.findUnique({where:{quizId_locale:{quizId:id,locale:p.locale}}});
      if(!loc||loc.status!=="PUBLISHED"||loc.publishedVersion===null)
        fail(404,"locale_unavailable","Quiz is not published in this language");
      publishedVersion=loc.publishedVersion;
    } else {
      const loc=await tx.quizPackLocalization.findUnique({where:{packId_locale:{packId:id,locale:p.locale}}});
      if(!loc||loc.status!=="PUBLISHED")
        fail(404,"locale_unavailable","Quiz pack is not published in this language");
    }
    // A recently cleared report cannot be immediately re-filed by the same account.
    const since=new Date(Date.now()-86400000);
    const existing=kind==="QUIZ"
      ?await tx.report.findFirst({where:{quizId:id,reporterId:user.id,
        OR:[{status:"OPEN"},{createdAt:{gte:since}}]}})
      :await tx.packReport.findFirst({where:{packId:id,reporterId:user.id,
        OR:[{status:"OPEN"},{createdAt:{gte:since}}]}});
    if(existing)fail(409,"already_reported","You recently reported this content");
    const [quizCount,packCount]=await Promise.all([
      tx.report.count({where:{reporterId:user.id,createdAt:{gte:since}}}),
      tx.packReport.count({where:{reporterId:user.id,createdAt:{gte:since}}})
    ]);
    if(quizCount+packCount>=10)fail(429,"rate_limit","Daily report limit reached");
    let report:{id:string;status:string;createdAt:Date};
    if(kind==="QUIZ"){
      const rev=await tx.quizRevision.findFirst({where:{quizId:id,version:publishedVersion!,
        localization:{locale:p.locale,status:"PUBLISHED"}}});
      if(!rev)fail(409,"revision_missing","Published revision unavailable");
      report=await tx.report.create({data:{quizId:id,reporterId:user.id,
        revisionId:rev.id,locale:p.locale,reason:p.reason,detail:p.detail}});
    }else{
      report=await tx.packReport.create({data:{packId:id,reporterId:user.id,
        locale:p.locale,reason:p.reason,detail:p.detail}});
    }
    const policy=await tx.moderationPolicy.findUnique({where:{id:"default"}}) ?? DEFAULT_REPORT_HOLD_POLICY;
    let held=false;
    if(policy.enabled){
      const windowStart=new Date(Date.now()-policy.windowHours*3600000);
      const reports=kind==="QUIZ"
        ?await tx.report.findMany({where:{quizId:id,status:"OPEN",createdAt:{gte:windowStart}},
          select:{reporterId:true,reporter:{select:{createdAt:true}}}})
        :await tx.packReport.findMany({where:{packId:id,status:"OPEN",createdAt:{gte:windowStart}},
          select:{reporterId:true,reporter:{select:{createdAt:true}}}});
      const reporters=new Map<string,Date>();
      for(const r of reports)reporters.set(r.reporterId,r.reporter.createdAt);
      const ageCutoff=new Date(Date.now()-policy.establishedAccountDays*86400000);
      const established=[...reporters.values()].filter(created=>created<=ageCutoff).length;
      if(shouldAutoHold(policy,kind,reporters.size,established)){
        const where={id,publication:"PUBLISHED",safetyStatus:"ACTIVE"};
        const changed=kind==="QUIZ"
          ?await tx.quiz.updateMany({where,data:{safetyStatus:"UNDER_REVIEW"}})
          :await tx.quizPack.updateMany({where,data:{safetyStatus:"UNDER_REVIEW"}});
        held=changed.count===1;
        if(held){
          await tx.auditLog.create({data:{actorId:user.id,
            action:kind==="QUIZ"?"quiz.auto_hold":"pack.auto_hold",objectId:id,
            detail:{reportId:report.id,reporters:reporters.size,established,
              threshold:kind==="QUIZ"?policy.quizReportThreshold:policy.packReportThreshold,
              windowHours:policy.windowHours}}});
          await notice(tx,item.authorId,kind,id,"UNDER_REVIEW","Content temporarily hidden pending staff review");
        }
      }
    }
    return {id:report.id,status:report.status,createdAt:report.createdAt,locale:p.locale,
      moderationStatus:held?"UNDER_REVIEW":item.safetyStatus};
  });
}

export async function moderationQueue(p:Record<string,any>,actor:Actor|null){
  staff(actor);
  const [quizzes,packs]=await Promise.all([
    db().quiz.findMany({where:{publication:"PUBLISHED",OR:[
      {safetyStatus:{in:["UNDER_REVIEW","RESTRICTED"]}},{reports:{some:{status:"OPEN"}}}
    ]},include:{
      author:{select:{displayName:true,publishingStatus:true,publishingRestrictedUntil:true}},
      reports:{where:{status:"OPEN"},select:{reporterId:true}},
      revisions:{orderBy:{createdAt:"desc"},take:1,select:{title:true}}
    },orderBy:{updatedAt:"desc"},take:100}),
    db().quizPack.findMany({where:{publication:"PUBLISHED",OR:[
      {safetyStatus:{in:["UNDER_REVIEW","RESTRICTED"]}},{reports:{some:{status:"OPEN"}}}
    ]},include:{
      author:{select:{displayName:true,publishingStatus:true,publishingRestrictedUntil:true}},
      reports:{where:{status:"OPEN"},select:{reporterId:true}}
    },orderBy:{updatedAt:"desc"},take:100})
  ]);
  const items=[
    ...quizzes.map(q=>({kind:"QUIZ" as const,id:q.id,title:q.revisions[0]?.title??"(Untitled)",
      authorId:q.authorId,author:q.author.displayName,
      publishingStatus:q.author.publishingStatus,publishingRestrictedUntil:q.author.publishingRestrictedUntil,
      safetyStatus:q.safetyStatus,reportCount:new Set(q.reports.map(r=>r.reporterId)).size,
      updatedAt:q.updatedAt})),
    ...packs.map(q=>({kind:"PACK" as const,id:q.id,title:q.title,authorId:q.authorId,
      author:q.author.displayName,publishingStatus:q.author.publishingStatus,
      publishingRestrictedUntil:q.author.publishingRestrictedUntil,
      safetyStatus:q.safetyStatus,reportCount:new Set(q.reports.map(r=>r.reporterId)).size,
      updatedAt:q.updatedAt}))
  ].sort((a,b)=>Number(b.safetyStatus==="UNDER_REVIEW")-Number(a.safetyStatus==="UNDER_REVIEW")
    ||b.reportCount-a.reportCount||b.updatedAt.getTime()-a.updatedAt.getTime());
  return {items:items.slice(0,p.limit),total:items.length,limit:p.limit};
}

export async function moderationContentReview(p:Record<string,any>,actor:Actor|null){
  const admin=staff(actor);
  if(p.decision==="RESTRICTED"&&p.reason.trim().length<5)
    fail(422,"reason_required","Restriction needs a specific explanation");
  return db().$transaction(async tx=>{
    const kind:TargetKind=p.kind;
    const target=kind==="QUIZ"?
      await tx.quiz.findUnique({where:{id:p.id}}):
      await tx.quizPack.findUnique({where:{id:p.id}});
    if(!target||target.publication!=="PUBLISHED")fail(404,"not_found","Published content not found");
    if(p.decision==="RESTORED"&&target.safetyStatus!=="RESTRICTED")
      fail(409,"not_restricted","Only restricted content can be restored");
    if(p.decision==="CLEARED"&&target.safetyStatus==="RESTRICTED")
      fail(409,"restricted_content","Use RESTORED to lift a staff restriction");
    const next=p.decision==="RESTRICTED"?"RESTRICTED":"ACTIVE";
    const where={id:p.id,safetyStatus:target.safetyStatus,publication:"PUBLISHED"};
    const data:any={safetyStatus:next};
    if(kind==="QUIZ"){
      data.moderationReviewedAt=new Date();
      if(p.decision==="RESTRICTED"){
        data.kidsEligible=false;
        data.kidsReviewStatus="REJECTED";
      }
      const result=await tx.quiz.updateMany({where,data});
      if(result.count!==1)fail(409,"review_conflict","Content changed during review");
      await tx.report.updateMany({where:{quizId:p.id,status:"OPEN"},data:{status:"CLOSED"}});
    } else {
      if(p.decision==="RESTRICTED"){
        data.kidsEligible=false;
        data.kidsReviewStatus="NOT_REQUESTED";
      }
      const result=await tx.quizPack.updateMany({where,data});
      if(result.count!==1)fail(409,"review_conflict","Content changed during review");
      await tx.packReport.updateMany({where:{packId:p.id,status:"OPEN"},data:{status:"CLOSED"}});
    }
    await tx.auditLog.create({data:{actorId:admin.id,
      action:kind==="QUIZ"?"quiz.moderation_review":"pack.moderation_review",
      objectId:p.id,detail:{decision:p.decision,reason:p.reason,previous:target.safetyStatus}}});
    await notice(tx,target.authorId,kind,p.id,p.decision,
      p.decision==="RESTRICTED"?"Content restricted: "+p.reason
      :p.decision==="RESTORED"?"Content restriction lifted"
      :"Staff review complete. Content is public again");
    return {kind,id:p.id,safetyStatus:next,verdict:p.decision};
  });
}

export async function publisherGet(p:Record<string,any>,actor:Actor|null){
  staff(actor);
  const person=await db().user.findUnique({where:{id:p.userId},
    select:{id:true,displayName:true,role:true,publishingStatus:true,
      publishingRestrictedUntil:true,createdAt:true}});
  if(!person)fail(404,"user_not_found","User not found");
  const [quizIds,packIds,accountHistory]=await Promise.all([
    db().quiz.findMany({where:{authorId:p.userId},select:{id:true}}),
    db().quizPack.findMany({where:{authorId:p.userId},select:{id:true}}),
    db().auditLog.findMany({where:{objectId:p.userId,action:"publisher.restriction_change"},
      orderBy:{createdAt:"desc"},take:15,select:{detail:true,createdAt:true}})
  ]);
  const identifiers=[...quizIds,...packIds].map(item=>item.id);
  const decisions=identifiers.length?await db().auditLog.findMany({where:{
    objectId:{in:identifiers},action:{in:["quiz.moderation_review","pack.moderation_review",
      "quiz.review","pack.general.moderation"]}},select:{objectId:true,action:true,detail:true,createdAt:true},
    orderBy:{createdAt:"desc"},take:200}):[];
  const confirmed=decisions.filter(row=>{
    const d=row.detail;
    if(!d||typeof d!=="object"||Array.isArray(d))return false;
    return ("decision" in d&&d.decision==="RESTRICTED")||("verdict" in d&&d.verdict==="RESTRICTED");
  });
  return {...person,quizzes:quizIds.length,packs:packIds.length,
    confirmedViolationDecisions:confirmed.length,
    confirmedContentCount:new Set(confirmed.map(d=>d.objectId)).size,
    restrictionHistory:accountHistory.map(row=>({createdAt:row.createdAt,detail:row.detail}))};
}

export async function publisherSet(p:Record<string,any>,actor:Actor|null){
  const admin=staff(actor);
  const until=p.until?new Date(p.until):null;
  if(p.status==="RESTRICTED" && until && until<=new Date())
    fail(422,"invalid_expiry","Restriction end date must be in the future");
  if(p.status==="RESTRICTED" && p.reason.trim().length<5)
    fail(422,"reason_required","Provide a reason for restricting publishing");
  return db().$transaction(async tx=>{
    const target=await tx.user.findUnique({where:{id:p.userId}});
    if(!target)fail(404,"user_not_found","User not found");
    if(target.role==="ADMIN")fail(403,"admin_protected","Administrator accounts cannot be publishing-restricted");
    const updated=await tx.user.update({where:{id:p.userId},data:{
      publishingStatus:p.status,publishingRestrictedUntil:p.status==="RESTRICTED"?until:null
    },select:{id:true,publishingStatus:true,publishingRestrictedUntil:true}});
    await tx.auditLog.create({data:{actorId:admin.id,action:"publisher.restriction_change",objectId:p.userId,
      detail:{previous:target.publishingStatus,status:p.status,until:p.status==="RESTRICTED"?p.until??null:null,reason:p.reason}}});
    await notice(tx,p.userId,"PUBLISHER",p.userId,p.status==="RESTRICTED"?"PUBLISHING_RESTRICTED":"PUBLISHING_RESTORED",
      p.status==="RESTRICTED"?"Publishing restricted: "+p.reason:"Your publishing access has been restored");
    return updated;
  });
}
