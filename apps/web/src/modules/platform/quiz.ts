import { randomUUID } from "node:crypto";
import { db } from "./db";
import { ratingsForQuizzes, ratingsForQuiz } from "./ratings";
import { fail, requireActor, type Actor } from "./auth";
import { validateMediaReferences } from "./media";
import { saveTopicLinks, topicSummaries, normalizeTopicKey, localizedTopicSummaries } from "./topics";
import { playableQuizWhere, currentPlayableRevision } from "./content-locale";
import type { Locale } from "../../i18n/core";
import { detectQuizLocale } from "./translation-language";
function normalizeClues(clues: any[]) {
  return clues.map((clue, i) => ({ ...clue, id: randomUUID(), order: i + 1 }));
}
async function revision(quizId: string, version: number) {
  const row = await db().quizRevision.findFirst({ where: { quizId, version, localization: { origin: { in:["ORIGINAL","LEGACY"] } } } });
  if (!row) return fail(404, "not_found", "Quiz revision not found");
  return row;
}
export async function quizList(p: Record<string, any>, actor: Actor | null) {
  if (p.mine) requireActor(actor);
  const locale: Locale = p.locale;
  const where: any = p.mine ? { authorId: actor!.id } : playableQuizWhere(locale, p.kids ? "KIDS" : "GENERAL");
  if (p.mode) where.mode = p.mode;
  if (p.answerType) where.answerType = p.answerType;
  if (p.topic) where.topicLinks = { some: {
    topic: { OR: [
      { key: normalizeTopicKey(p.topic) },
      { localizations: { some: { locale, name: { equals: p.topic, mode: "insensitive" } } } }
    ] }, isSpoiler: false
  } };
  // Language eligibility is applied by PostgreSQL *before* OFFSET/LIMIT.
  const rows = await db().quiz.findMany({ where, include: {
    localizations: { where: { locale } },
    topicLinks: { include: { topic: { include: { localizations: { where: { locale } } } } }, orderBy: { position: "asc" } }
  }, orderBy: { updatedAt: "desc" }, skip: p.offset, take: p.limit });
  const summaries = await ratingsForQuizzes(rows.map(q=>q.id),locale);
  const selected = await db().quizRevision.findMany({
    where: { OR: rows.map(q => {
      const l = q.localizations[0];
      return { quizId: q.id, version: p.mine ? q.currentVersion : l?.publishedVersion ?? -1,
        ...(p.mine ? {localization: {origin: {in:["ORIGINAL","LEGACY"]}}} : { localizationId: l?.id ?? "" }) };
    }) }
  });
  const revisions = new Map(selected.map(r => [r.quizId, r]));
  const items = rows.map(quiz => {
    const r = revisions.get(quiz.id);
    if (!r) fail(409, "localized_revision_missing", "Quiz language version is missing");
    return { id: quiz.id, title: r.title, prompt: r.prompt, mode: r.mode, answerType: r.answerType,
      locale: p.mine ? quiz.sourceLocale : locale,
      topics: p.mine ? topicSummaries(quiz.topicLinks, true) : localizedTopicSummaries(quiz.topicLinks),
      clueCount: (r.clues as any[]).length,
      version: r.version, publication: quiz.publication, safetyStatus: quiz.safetyStatus,
      recommendedAudience: quiz.recommendedAudience, kidsReviewStatus:quiz.kidsReviewStatus, ratings: summaries.get(quiz.id),
      kidsEligible: quiz.kidsEligible && quiz.safetyStatus !== "RESTRICTED" };
  });
  return { items, locale, offset: p.offset, limit: p.limit };
}
export async function quizGet(id: string, actor: Actor | null, locale: Locale = "en") {
  const quiz = await db().quiz.findUnique({ where: { id }, include: {
    topicLinks: { include: { topic: { include: { localizations: { where: { locale } } } } }, orderBy: { position: "asc" } }
  } });
  if (!quiz) fail(404, "not_found", "Quiz not found");
  const owned = actor?.id === quiz.authorId;
  if (!owned && (quiz.publication !== "PUBLISHED" || quiz.safetyStatus === "RESTRICTED"))
    fail(404, "not_found", "Quiz not found");
  // Owners can always manage legacy unclassified quiz versions in Studio.
  const r = owned ? await revision(id, quiz.currentVersion)
    : (await currentPlayableRevision(id, locale)).revision;
  const ratings = await ratingsForQuiz(id,locale);
  return { id, title: r.title, prompt: r.prompt, mode: r.mode, answerType: r.answerType,
    locale: owned ? quiz.sourceLocale : locale,
    topics: owned ? topicSummaries(quiz.topicLinks, true) : localizedTopicSummaries(quiz.topicLinks),
    clueCount: (r.clues as any[]).length, promptMediaIds: (owned ? r.promptMediaIds : undefined),
    version: r.version, publication: quiz.publication,
    creatorIntent: owned ? quiz.creatorIntent : undefined,
    recommendedAudience: quiz.recommendedAudience, ratings, safetyStatus: quiz.safetyStatus,
    kidsReviewStatus:quiz.kidsReviewStatus,
    kidsEligible: quiz.kidsEligible && quiz.safetyStatus !== "RESTRICTED",
    ...(owned ? { answer: r.answer, clues: r.clues, authorId: quiz.authorId } : {}) };
}
export async function quizCreate(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  await validateMediaReferences(user.id, p.promptMediaIds ?? [], p.clues);
  const locale = p.locale ?? detectQuizLocale({title:p.title,prompt:p.prompt,clues:p.clues});
  const localizationId = randomUUID();
  const quiz = await db().$transaction(async tx => {
    const created = await tx.quiz.create({ data: {
      authorId: user.id, mode: p.mode, answerType: p.answerType, sourceLocale: locale,
      safetyStatus:"ACTIVE",kidsReviewStatus:p.kidsRequested?"REQUESTED":"NOT_REQUESTED",
      ...(p.creatorIntent ? { creatorIntent: p.creatorIntent } : {}),
      ...(p.recommendedAudience ? { recommendedAudience: p.recommendedAudience } : {}),
    } });
    await tx.quizLocalization.create({ data: {
      id:localizationId,quizId:created.id,locale,status:"DRAFT",currentVersion:1,origin:"ORIGINAL"
    } });
    await tx.quizRevision.create({data:{
      quizId:created.id,version:1,localizationId,
      title:p.title,prompt:p.prompt,mode:p.mode,answerType:p.answerType,
      answer:p.answer,clues:normalizeClues(p.clues),promptMediaIds:p.promptMediaIds ?? []
    }});
    await saveTopicLinks(tx, created.id, p.topics ?? [], p.answer, locale);
    return created;
  });
  return quizGet(quiz.id, actor, locale === "und" ? "en" : locale);
}
export async function quizUpdate(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  const old = await db().quiz.findUnique({ where: { id: p.id } });
  if (!old || old.authorId !== user.id) fail(404, "not_found", "Quiz not found");
  if (p.locale !== undefined && p.locale !== old.sourceLocale)
    fail(409, "language_change_requires_confirmation", "Use the original-language confirmation action");
  if (p.expectedVersion !== old.currentVersion) fail(409, "version_conflict", "Refresh quiz and try again");
  const prior = await revision(old.id, old.currentVersion);
  const modified = ["title", "prompt", "mode", "answerType", "answer", "clues", "promptMediaIds", "topics"].some(key => p[key] !== undefined);
  const nextClues = (p.clues ?? prior.clues) as any[];
  const nextPromptMediaIds = (p.promptMediaIds ?? prior.promptMediaIds) as string[];
  await validateMediaReferences(user.id, nextPromptMediaIds, nextClues, old.publication === "PUBLISHED");
  if (old.safetyStatus === "RESTRICTED")
    fail(403, "restricted_quiz", "Restricted quizzes require trusted moderation clearance");
  await db().$transaction(async tx => {
    const changed = await tx.quiz.updateMany({
      where: { id: old.id, authorId: user.id, currentVersion: p.expectedVersion, safetyStatus:old.safetyStatus },
      data: { currentVersion: { increment: 1 }, kidsEligible: false,
        kidsReviewStatus:p.kidsRequested===false?"NOT_REQUESTED":p.kidsRequested===true?"REQUESTED":
          old.kidsReviewStatus==="NOT_REQUESTED"?"NOT_REQUESTED":"REQUESTED",
        ...(p.mode !== undefined ? { mode: p.mode } : {}),
        ...(p.answerType !== undefined ? { answerType: p.answerType } : {}),
        ...(p.creatorIntent !== undefined ? { creatorIntent: p.creatorIntent } : {}),
        ...(p.recommendedAudience !== undefined ? { recommendedAudience: p.recommendedAudience } : {}) }
    });
    if (changed.count !== 1) fail(409, "version_conflict", "Quiz changed while editing");
    const localization = await tx.quizLocalization.findUnique({where:{quizId_locale:{quizId:old.id,locale:old.sourceLocale}}});
    if(!localization) fail(409,"localized_revision_missing","Quiz language version is missing");
    const bumped = await tx.quizLocalization.updateMany({where:{id:localization.id,currentVersion:p.expectedVersion},
      data:{currentVersion:{increment:1},...(old.publication==="PUBLISHED"?{publishedVersion:p.expectedVersion+1}:{})}});
    if(bumped.count!==1) fail(409,"version_conflict","Localized version changed while editing");
    await tx.quizRevision.create({ data: { quizId: old.id, version: p.expectedVersion + 1, localizationId: localization.id,
      title: p.title ?? prior.title, prompt: p.prompt ?? prior.prompt, mode: p.mode ?? prior.mode,
      answerType: p.answerType ?? prior.answerType,
      answer: (p.answer ?? prior.answer) as any, clues: (p.clues ? normalizeClues(p.clues) : prior.clues) as any,
      promptMediaIds: nextPromptMediaIds as any } });
    if (p.topics !== undefined) await saveTopicLinks(tx, old.id, p.topics, (p.answer ?? prior.answer) as any, old.sourceLocale);
    else if (p.answer !== undefined) {
      const existing = await tx.quizTopic.findMany({ where: { quizId: old.id }, include: { topic: true }, orderBy: { position: "asc" } });
      await saveTopicLinks(tx, old.id, existing.map(link => ({ name: link.topic.name, isSpoiler: link.isSpoiler })), p.answer, old.sourceLocale);
    }
    await tx.auditLog.create({ data: { actorId: user.id, action: modified ? "quiz.edit" : "quiz.settings", objectId: old.id } });
  });
  return quizGet(old.id, actor);
}
export async function quizPublish(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  if (p.confirm !== true) fail(400, "confirmation_required", "User must confirm publishing");
  const old = await db().quiz.findFirst({ where: { id: p.id, authorId: user.id } });
  if (!old) fail(404, "not_found", "Quiz not found");
  if (old.safetyStatus === "RESTRICTED") fail(403, "restricted_quiz", "Quiz is restricted");
  if (old.publication === "PUBLISHED") return { id:old.id, publication:"PUBLISHED",
    kidsReviewStatus:old.kidsReviewStatus,alreadyPublished:true };
  const currentRevision = await revision(old.id, old.currentVersion);
  await validateMediaReferences(user.id, currentRevision.promptMediaIds as string[], currentRevision.clues as any[], true);
  if (old.publication !== "PUBLISHED" && user.role !== "ADMIN") {
    const recent = await db().auditLog.count({ where: { actorId: user.id, action: "quiz.publish", createdAt: { gte: new Date(Date.now() - 86400000) } } });
    if (recent >= 100) fail(429, "rate_limit", "Daily publication limit reached");
  }
  await db().$transaction(async tx => {
    await tx.quiz.update({ where: { id: old.id }, data: { publication: "PUBLISHED", kidsEligible: false, safetyStatus: "ACTIVE",
        kidsReviewStatus:old.kidsReviewStatus==="NOT_REQUESTED"?"NOT_REQUESTED":"REQUESTED" } });
    await tx.quizLocalization.updateMany({where:{quizId:old.id,locale:old.sourceLocale},data:{status:"PUBLISHED",publishedVersion:old.currentVersion}});
    await tx.auditLog.create({ data: { actorId: user.id, action: "quiz.publish", objectId: old.id } });
  });
  return { id: old.id, publication: "PUBLISHED", kidsReviewStatus:old.kidsReviewStatus==="NOT_REQUESTED"?"NOT_REQUESTED":"REQUESTED" };
}

/** Creator intent alone never grants child access; staff must approve the request. */
export async function quizKidsRequest(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  const quiz=await db().quiz.findFirst({where:{id:p.id,authorId:user.id}});
  if(!quiz)fail(404,"not_found","Quiz not found");
  if(p.requested && quiz.safetyStatus==="RESTRICTED")
    fail(409,"restricted_quiz","Restricted quizzes cannot request Kids exposure");
  const status=p.requested
    ? quiz.kidsReviewStatus==="APPROVED"?"APPROVED":"REQUESTED"
    : "NOT_REQUESTED";
  await db().$transaction(async tx=>{
    const updated=await tx.quiz.updateMany({where:{id:quiz.id,authorId:user.id,currentVersion:quiz.currentVersion,
        safetyStatus:quiz.safetyStatus,kidsReviewStatus:quiz.kidsReviewStatus},
      data:{kidsReviewStatus:status,kidsEligible:status==="APPROVED"}});
    if(updated.count!==1)fail(409,"version_conflict","Quiz changed while requesting Kids review");
    await tx.auditLog.create({data:{actorId:user.id,action:p.requested?"quiz.kids.request":"quiz.kids.withdraw",
      objectId:quiz.id,detail:{version:quiz.currentVersion,status}}});
  });
  return {id:quiz.id,kidsReviewStatus:status,kidsEligible:status==="APPROVED"};
}

/** Explicitly classify a legacy original, never auto-translate or silently relabel. */
export async function quizLanguageSet(p: Record<string, any>, actor: Actor | null) {
  const owner = requireActor(actor);
  const result = await db().$transaction(async tx => {
    const quiz = await tx.quiz.findFirst({where:{id:p.id,authorId:owner.id}});
    if(!quiz) fail(404,"not_found","Quiz not found");
    if(quiz.sourceLocale===p.locale) return {id:quiz.id,locale:p.locale,alreadySet:true};
    if(quiz.sourceLocale!=="und") fail(409,"locale_already_classified",
      "Changing a classified quiz requires a separate translation workflow");
    const unknown = await tx.quizLocalization.findUnique({
      where:{quizId_locale:{quizId:quiz.id,locale:"und"}}});
    if(!unknown) fail(409,"unclassified_version_missing","Legacy original localization is missing");
    const updated=await tx.quiz.updateMany({where:{id:quiz.id,sourceLocale:"und"},
      data:{sourceLocale:p.locale}});
    if(updated.count!==1) fail(409,"locale_conflict","Quiz language was changed concurrently");
    await tx.quizLocalization.update({where:{id:unknown.id},data:{locale:p.locale}});
    const links=await tx.quizTopic.findMany({where:{quizId:quiz.id},include:{topic:true}});
    for(const link of links) {
      await tx.topicLocalization.upsert({
        where:{topicId_locale:{topicId:link.topicId,locale:p.locale}},
        create:{topicId:link.topicId,locale:p.locale,name:link.topic.name},
        update:{}
      });
    }
    await tx.auditLog.create({data:{actorId:owner.id,action:"quiz.language.classify",
      objectId:quiz.id,detail:{from:"und",to:p.locale,confirmed:p.confirm}}});
    return {id:quiz.id,locale:p.locale,alreadySet:false};
  });
  return result;
}
/** Post-publication review queue: only attention signals or explicit Kids requests.
 * Reports are deduplicated by reporter. Votes are deduplicated by player across locales.
 * Review checkpoints suppress old signals but never suppress later reports or votes.
 */
export async function adminQuizReviewList(p:Record<string,any>,actor:Actor|null) {
  const admin=requireActor(actor);
  if(admin.role!=="ADMIN")fail(403,"admin_required","Only trusted moderators may list quizzes");
  type QueueRow={id:string;title:string;mode:string;version:number;publication:string;
    safetyStatus:string;kidsEligible:boolean;kidsReviewStatus:string;
    reportCount:number;seriousReportCount:number;ratingCount:number;
    negativeCount:number;newNegativeCount:number;ratingFlag:boolean;total:number};
  const rows=await db().$queryRaw<QueueRow[]>`
    WITH signals AS (
      SELECT q."id",q."mode",q."currentVersion" AS "version",q."publication",
        q."safetyStatus",q."kidsEligible",q."kidsReviewStatus",q."updatedAt",
        COALESCE(rev."title",'(Unavailable original revision)') AS "title",
        (SELECT COUNT(DISTINCT r."reporterId")::int FROM "Report" r
          WHERE r."quizId"=q."id" AND r."status"='OPEN'
            AND (q."moderationReviewedAt" IS NULL OR r."createdAt">q."moderationReviewedAt")) AS "reportCount",
        (SELECT COUNT(DISTINCT r."reporterId")::int FROM "Report" r
          WHERE r."quizId"=q."id" AND r."status"='OPEN'
            AND r."reason" IN ('UNSAFE','COPYRIGHT','PRIVACY')
            AND (q."moderationReviewedAt" IS NULL OR r."createdAt">q."moderationReviewedAt")) AS "seriousReportCount",
        (SELECT COUNT(DISTINCT r."authorId")::int FROM "Review" r
          WHERE r."quizId"=q."id" AND r."kind"='QUIZ') AS "ratingCount",
        (SELECT COUNT(DISTINCT r."authorId")::int FROM "Review" r
          WHERE r."quizId"=q."id" AND r."kind"='QUIZ' AND r."rating"=-1) AS "negativeCount",
        (SELECT COUNT(DISTINCT r."authorId")::int FROM "Review" r
          WHERE r."quizId"=q."id" AND r."kind"='QUIZ' AND r."rating"=-1
            AND (q."moderationReviewedAt" IS NULL OR r."updatedAt">q."moderationReviewedAt")) AS "newNegativeCount"
      FROM "Quiz" q
      LEFT JOIN LATERAL (
        SELECT r."title" FROM "QuizRevision" r
        JOIN "QuizLocalization" l ON l."id"=r."localizationId"
        WHERE r."quizId"=q."id" AND r."version"=q."currentVersion"
          AND l."origin" IN ('ORIGINAL','LEGACY') LIMIT 1
      ) rev ON true
      WHERE q."publication"='PUBLISHED'
        AND (${p.search}='' OR EXISTS (
          SELECT 1 FROM "QuizRevision" r
          JOIN "QuizLocalization" l ON l."id"=r."localizationId"
          WHERE r."quizId"=q."id" AND l."origin" IN ('ORIGINAL','LEGACY')
            AND r."title" ILIKE '%' || ${p.search} || '%'
        ))
    ), flagged AS (
      SELECT *, ("ratingCount">=20 AND "negativeCount">=14
        AND "negativeCount"*100>=70*"ratingCount"
        AND "newNegativeCount">=5) AS "ratingFlag"
      FROM signals
    )
    SELECT "id","title","mode","version","publication","safetyStatus",
      "kidsEligible","kidsReviewStatus","reportCount","seriousReportCount",
      "ratingCount","negativeCount","newNegativeCount","ratingFlag",
      COUNT(*) OVER()::int AS "total"
    FROM flagged
    WHERE (${p.queue}='ALL'
      OR (${p.queue}='RESTRICTED' AND "safetyStatus"='RESTRICTED')
      OR (${p.queue}='KIDS' AND "safetyStatus"<>'RESTRICTED' AND "kidsReviewStatus"='REQUESTED')
      OR (${p.queue}='REPORTS' AND "safetyStatus"<>'RESTRICTED' AND "reportCount">0)
      OR (${p.queue}='RATINGS' AND "safetyStatus"<>'RESTRICTED' AND "ratingFlag")
      OR (${p.queue}='ATTENTION' AND "safetyStatus"<>'RESTRICTED'
        AND ("reportCount">0 OR "ratingFlag" OR "kidsReviewStatus"='REQUESTED')))
    ORDER BY ("seriousReportCount">0) DESC,"reportCount" DESC,
      "ratingFlag" DESC,("kidsReviewStatus"='REQUESTED') DESC,"updatedAt" DESC,"id" DESC
    LIMIT ${p.limit} OFFSET ${p.offset}
  `;
  return {items:rows.map(({total,...row})=>row),total:rows[0]?.total??0,
    limit:p.limit,offset:p.offset,threshold:{minRatings:20,minNegatives:14,negativePercent:70,newNegatives:5}};
}

/** Review is not a gate to adult publication. Kids approval is strictly opt-in. */
export async function quizReview(p:Record<string,any>,actor:Actor|null) {
  const admin=requireActor(actor);
  if(admin.role!=="ADMIN")fail(403,"admin_required","Only trusted staff can review a quiz");
  const quiz=await db().quiz.findUnique({where:{id:p.id}});
  if(!quiz)fail(404,"not_found","Quiz was not found");
  if(quiz.publication!=="PUBLISHED")fail(409,"not_published","Only published quizzes can be moderated");
  if(p.verdict==="KIDS_APPROVED"){
    if(quiz.safetyStatus==="RESTRICTED")fail(409,"restricted_quiz","Restricted quiz cannot enter Kids");
    if(quiz.kidsReviewStatus!=="REQUESTED")
      fail(409,"kids_not_requested","Only creator-requested quizzes can receive Kids approval");
    const rev=await revision(quiz.id,quiz.currentVersion);
    await validateMediaReferences(quiz.authorId,rev.promptMediaIds as string[],rev.clues as any[],true);
  }
  if(p.verdict==="KIDS_REJECTED"&&quiz.kidsReviewStatus!=="REQUESTED")
    fail(409,"kids_not_requested","Kids review is not pending");
  if(p.verdict==="RESTORED"&&quiz.safetyStatus!=="RESTRICTED")
    fail(409,"not_restricted","Quiz is not restricted");
  const data:Record<string,any>={};
  if(p.verdict==="CLEARED")data.moderationReviewedAt=new Date();
  if(p.verdict==="RESTRICTED"){
    data.safetyStatus="RESTRICTED";data.kidsEligible=false;data.moderationReviewedAt=new Date();
    if(quiz.kidsReviewStatus!=="NOT_REQUESTED")data.kidsReviewStatus="REJECTED";
  }
  if(p.verdict==="RESTORED"){data.safetyStatus="ACTIVE";data.moderationReviewedAt=new Date();}
  if(p.verdict==="KIDS_APPROVED"){data.kidsEligible=true;data.kidsReviewStatus="APPROVED";}
  if(p.verdict==="KIDS_REJECTED"){data.kidsEligible=false;data.kidsReviewStatus="REJECTED";}
  await db().$transaction(async tx=>{
    const updated=await tx.quiz.updateMany({where:{
      id:quiz.id,currentVersion:quiz.currentVersion,safetyStatus:quiz.safetyStatus,
      kidsReviewStatus:quiz.kidsReviewStatus
    },data});
    if(updated.count!==1)fail(409,"review_conflict","Quiz changed during moderation. Refresh and retry");
    await tx.auditLog.create({data:{actorId:admin.id,action:"quiz.review",objectId:quiz.id,
      detail:{verdict:p.verdict,reason:p.reason,version:quiz.currentVersion}}});
  });
  return {id:quiz.id,verdict:p.verdict,version:quiz.currentVersion};
}

export async function quizReviewGet(p:Record<string,any>,actor:Actor|null) {
  const admin=requireActor(actor);
  if(admin.role!=="ADMIN")fail(403,"admin_required","Quiz review details require administrator authority");
  const item=await db().quiz.findUnique({where:{id:p.id},
    include:{topicLinks:{include:{topic:true},orderBy:{position:"asc"}}}});
  if(!item)fail(404,"not_found","Quiz not found");
  const current=await revision(item.id,item.currentVersion);
  const [childReportCounts,reports,reviewCounts]=await Promise.all([
    db().kidSafetyReport.groupBy({by:["reason"],where:{quizId:item.id},_count:{_all:true}}),
    db().report.findMany({where:{quizId:item.id,status:"OPEN",
      ...(item.moderationReviewedAt?{createdAt:{gt:item.moderationReviewedAt}}:{})},
      orderBy:{createdAt:"desc"},take:30,select:{reason:true,detail:true,createdAt:true}}),
    db().review.groupBy({by:["rating"],where:{quizId:item.id,kind:"QUIZ"},_count:{_all:true}})
  ]);
  return {childSafetySignals:childReportCounts.map(row=>({reason:row.reason,count:row._count._all})),
    reports,reviews:{positive:reviewCounts.find(x=>x.rating===1)?._count._all??0,
      negative:reviewCounts.find(x=>x.rating===-1)?._count._all??0},
    id:item.id,authorId:item.authorId,version:item.currentVersion,
    title:current.title,prompt:current.prompt,mode:current.mode,answerType:current.answerType,
    topics:topicSummaries(item.topicLinks,true),answer:current.answer,
    clues:current.clues,promptMediaIds:current.promptMediaIds,creatorIntent:item.creatorIntent,
    recommendedAudience:item.recommendedAudience,
    safetyStatus:item.safetyStatus,kidsReviewStatus:item.kidsReviewStatus,
    kidsEligible:item.kidsEligible,publication:item.publication};
}
