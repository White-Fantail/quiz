import { db } from "./db";
import { ratingsForQuiz } from "./ratings";
import { currentPlayableRevision } from "./content-locale";
import { fail, requireActor, type Actor } from "./auth";
import { playableQuizWhere } from "./content-locale";

async function getPublicQuiz(quizId: string) {
  const q = await db().quiz.findUnique({ where: { id: quizId } });
  if (!q || q.publication !== "PUBLISHED" || q.safetyStatus === "RESTRICTED")
    fail(404, "not_found", "Published quiz not found");
  return q;
}
export async function reviewsList(p:Record<string,any>) {
  await getPublicQuiz(p.quizId);
  const loc=await db().quizLocalization.findUnique({where:{quizId_locale:{quizId:p.quizId,locale:p.locale}}});
  if(loc?.status!=="PUBLISHED" || loc.publishedVersion==null)
    fail(404,"locale_unavailable","Quiz unavailable in chosen language");
  if(p.kind==="TRANSLATION" && loc.origin!=="TRANSLATION")
    fail(400,"not_translated","Translation reviews require translated content");
  const where={quizId:p.quizId,locale:p.locale,kind:p.kind};
  const [items,count]=await Promise.all([
    db().review.findMany({where,select:{id:true,rating:true,comment:true,createdAt:true,locale:true,kind:true,
      author:{select:{displayName:true}}},orderBy:{createdAt:"desc"},skip:p.offset,take:p.limit}),
    db().review.count({where})
  ]);
  return {items,count,locale:p.locale,kind:p.kind};
}
export async function reviewUpsert(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  const quiz=await getPublicQuiz(p.quizId);
  if(quiz.authorId===user.id)fail(403,"self_review","Cannot review own quiz");
  const loc=await db().quizLocalization.findUnique({where:{quizId_locale:{quizId:quiz.id,locale:p.locale}}});
  if(loc?.status!=="PUBLISHED" || loc.publishedVersion==null)
    fail(404,"locale_unavailable","Quiz unavailable in this language");
  if(p.kind==="TRANSLATION" && loc.origin!=="TRANSLATION")
    fail(400,"not_translated","Translation feedback requires a translated version");
  const completed=await db().playSession.findFirst({
    where:{quizId:quiz.id,userId:user.id,locale:p.locale,status:{in:["SOLVED","FAILED"]},
      revision:{localizationId:loc.id}},
    select:{revisionId:true},orderBy:{finishedAt:"desc"}
  });
  if(!completed)fail(403,"play_required","Finish this language version before reviewing");
  const review=await db().review.upsert({
    where:{quizId_authorId_locale_kind:{quizId:quiz.id,authorId:user.id,locale:p.locale,kind:p.kind}},
    create:{quizId:quiz.id,authorId:user.id,locale:p.locale,kind:p.kind,
      revisionId:completed.revisionId,rating:p.rating,comment:p.comment},
    update:{revisionId:completed.revisionId,rating:p.rating,comment:p.comment}
  });
  return {id:review.id,locale:p.locale,kind:p.kind,rating:review.rating,comment:review.comment,
    updatedAt:review.updatedAt,ratings:await ratingsForQuiz(quiz.id,p.locale,p.kind)};
}
export async function reviewRemove(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  const deleted=await db().review.deleteMany({where:{quizId:p.quizId,authorId:user.id,
    locale:p.locale,kind:p.kind}});
  return {removed:deleted.count>0,locale:p.locale,kind:p.kind,rating:null,
    ratings:await ratingsForQuiz(p.quizId,p.locale,p.kind)};
}
export async function reportCreate(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  await getPublicQuiz(p.quizId);
  const {revision}=await currentPlayableRevision(p.quizId,p.locale);
  const recent=await db().report.count({where:{
    reporterId:user.id,createdAt:{gte:new Date(Date.now()-86400000)}
  }});
  if(recent>=10)fail(429,"rate_limit","Daily report limit reached");
  const report=await db().report.create({data:{
    quizId:p.quizId,reporterId:user.id,locale:p.locale,revisionId:revision.id,
    reason:p.reason,detail:p.detail
  }});
  return {id:report.id,locale:p.locale,status:report.status,createdAt:report.createdAt};
}
export async function reportsMine(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  return { items: await db().report.findMany({
    where: { reporterId: user.id },
    select: { id: true, quizId: true, reason: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" }, skip: p.offset, take: p.limit
  }) };
}
async function validatePackQuestions(ids: string[], authorId: string, publish = false, locale = "und") {
  if (new Set(ids).size !== ids.length) fail(400, "duplicate_quiz", "Pack questions must be unique");
  const qs = await db().quiz.findMany({ where: { id: { in: ids } },
    include: { localizations: true } });
  if (qs.length !== ids.length || qs.some(q => (q.authorId !== authorId && q.publication !== "PUBLISHED") ||
    q.safetyStatus === "RESTRICTED" || (publish && q.publication !== "PUBLISHED")))
    fail(400, "invalid_pack", "Pack has unavailable or unpublished questions");
  if(publish && locale!=="und" && qs.some(q=>!q.localizations.some(l=>l.locale===locale && l.status==="PUBLISHED")))
    fail(409,"incomplete_pack_locale","Every question must be published in the pack language");
}
/** Creator-only dry-run. Never mutates content or exposes other creators' drafts. */
export async function packPreflight(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  const pack=await db().quizPack.findFirst({where:{id:p.id,authorId:user.id},
    include:{items:{orderBy:{position:"asc"}}}});
  if(!pack)fail(404,"not_found","Pack not found");
  const ids=pack.items.map(item=>item.quizId);
  const quizzes=await db().quiz.findMany({where:{id:{in:ids}},
    select:{id:true,authorId:true,publication:true,safetyStatus:true,currentVersion:true,
      localizations:{where:{locale:pack.sourceLocale},select:{status:true,publishedVersion:true,currentVersion:true}}}});
  const byId=new Map(quizzes.map(q=>[q.id,q]));
  const issues:{quizId:string;code:string}[]=[];
  if(!ids.length)issues.push({quizId:pack.id,code:"empty_pack"});
  if(pack.sourceLocale==="und")issues.push({quizId:pack.id,code:"source_language_required"});
  for(const id of ids){
    const quiz=byId.get(id);
    if(!quiz){issues.push({quizId:id,code:"missing_quiz"});continue;}
    if(quiz.safetyStatus==="RESTRICTED")issues.push({quizId:id,code:"restricted"});
    if(quiz.authorId!==user.id && quiz.publication!=="PUBLISHED")issues.push({quizId:id,code:"unavailable_external_quiz"});
    const loc=quiz.localizations[0];
    if(!loc)issues.push({quizId:id,code:"missing_localization"});
    else if(quiz.authorId!==user.id && (loc.status!=="PUBLISHED" || loc.publishedVersion==null))
      issues.push({quizId:id,code:"external_translation_unpublished"});
  }
  const unpublished=quizzes.filter(q=>q.authorId===user.id && q.publication!=="PUBLISHED").length;
  const publishedToday=user.role==="ADMIN"?0:await db().auditLog.count({where:{
    actorId:user.id,action:"quiz.publish",createdAt:{gte:new Date(Date.now()-86400000)}}});
  if(user.role!=="ADMIN" && publishedToday+unpublished>100)
    issues.push({quizId:pack.id,code:"publication_quota_exceeded"});
  return {id:pack.id,locale:pack.sourceLocale,total:ids.length,unpublished,
    quotaRemaining:user.role==="ADMIN"?null:Math.max(0,100-publishedToday),
    ready:issues.length===0,issues};
}
export async function packCreate(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  await validatePackQuestions(p.quizIds, user.id);
  const pack = await db().quizPack.create({
    data: { authorId: user.id, title: p.title, description: p.description,
      sourceLocale: p.locale,
      localizations: { create: { locale: p.locale, title: p.title, description: p.description, status: "DRAFT" } },
      items: { create: p.quizIds.map((quizId: string, index: number) => ({ quizId, position: index + 1 })) } },
    include: { items: { orderBy: { position: "asc" } } }
  });
  return pack;
}
export async function packList(p: Record<string, any>, actor: Actor | null) {
  if (p.mine) requireActor(actor);
  const locale = p.locale as "en" | "ko";
  // PostgreSQL enforces whole-pack language coverage before pagination.
  const where: any = p.mine ? { authorId: actor!.id } : {
    publication: "PUBLISHED",
    localizations: { some: { locale, status: "PUBLISHED" } },
    items: { some: {}, every: { quiz: playableQuizWhere(locale) } }
  };
  const packs = await db().quizPack.findMany({
    where, orderBy: { updatedAt: "desc" }, skip: p.offset, take: p.limit,
    include: { localizations: { where: { locale } }, items: { orderBy: { position: "asc" } } }
  });
  return { locale, items: packs.map(pack => {
    const l = pack.localizations[0];
    return { id:pack.id, title: p.mine ? pack.title : l?.title,
      description: p.mine ? pack.description : l?.description,
      publication:pack.publication, quizIds:pack.items.map(item=>item.quizId) };
  }) };
}
/** Author confirmation of a legacy pack's ORIGINAL language, never an automatic translation. */
export async function packLanguageSet(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  return db().$transaction(async tx => {
    const old=await tx.quizPack.findFirst({where:{id:p.id,authorId:user.id},
      include:{items:true}});
    if(!old) fail(404,"not_found","Pack not found");
    if(old.sourceLocale===p.locale) return {id:old.id,locale:p.locale,alreadySet:true};
    if(old.sourceLocale!=="und") fail(409,"locale_already_classified","Pack already has an original language");
    const oldLocale=await tx.quizPackLocalization.findUnique({
      where:{packId_locale:{packId:old.id,locale:"und"}}});
    if(!oldLocale) fail(409,"locale_missing","Legacy pack localization is missing");
    if(old.publication==="PUBLISHED") {
      const valid=await tx.quiz.count({where:{id:{in:old.items.map(item=>item.quizId)},
        ...playableQuizWhere(p.locale)}});
      if(valid!==old.items.length)
        fail(409,"incomplete_pack_locale","All questions must exist in the selected pack language");
    }
    const changed=await tx.quizPack.updateMany({where:{id:old.id,sourceLocale:"und"},
      data:{sourceLocale:p.locale}});
    if(changed.count!==1) fail(409,"locale_conflict","Pack language changed concurrently");
    await tx.quizPackLocalization.update({where:{id:oldLocale.id},data:{locale:p.locale}});
    await tx.auditLog.create({data:{actorId:user.id,action:"pack.language.classify",
      objectId:old.id,detail:{from:"und",to:p.locale,confirmed:true}}});
    return {id:old.id,locale:p.locale,alreadySet:false};
  });
}
/** Localized pack titles and descriptions without falling back to another language. */
export async function packLanguages(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  const pack=await db().quizPack.findFirst({where:{id:p.id,authorId:user.id},
    include:{items:true,localizations:{orderBy:{locale:"asc"}}}});
  if(!pack)fail(404,"not_found","Owned pack not found");
  const ids=pack.items.map(i=>i.quizId);
  const coverage=await Promise.all((["en","ko"] as const).map(async locale=>({
    locale,complete:ids.length>0 && await db().quiz.count({
      where:{id:{in:ids},...playableQuizWhere(locale)}
    })===ids.length
  })));
  return {id:pack.id,sourceLocale:pack.sourceLocale,publication:pack.publication,
    languages:pack.localizations.map(l=>({locale:l.locale,status:l.status,title:l.title,description:l.description})),
    coverage};
}
export async function packTranslationUpsert(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  const pack=await db().quizPack.findFirst({where:{id:p.id,authorId:user.id},
    include:{items:true}});
  if(!pack)fail(404,"not_found","Owned pack not found");
  if(pack.sourceLocale==="und" || pack.sourceLocale===p.locale)
    fail(409,"invalid_translation_language","Classify the original pack and select another language");
  if(p.status==="PUBLISHED"){
    if(!p.confirm)fail(400,"confirmation_required","Confirm translated pack publication");
    if(pack.publication!=="PUBLISHED")fail(409,"pack_not_published","Publish the original pack first");
    const ids=pack.items.map(item=>item.quizId);
    if(!ids.length || await db().quiz.count({where:{id:{in:ids},...playableQuizWhere(p.locale)}})!==ids.length)
      fail(409,"incomplete_pack_locale","Every pack question must be published in that language");
  }
  const result=await db().$transaction(async tx=>{
    const saved=await tx.quizPackLocalization.upsert({
      where:{packId_locale:{packId:pack.id,locale:p.locale}},
      create:{packId:pack.id,locale:p.locale,title:p.title,description:p.description,status:p.status},
      update:{title:p.title,description:p.description,status:p.status}
    });
    await tx.auditLog.create({data:{actorId:user.id,action:"pack.translation.save",objectId:pack.id,
      detail:{locale:p.locale,status:p.status}}});
    return saved;
  });
  return {id:pack.id,locale:result.locale,status:result.status,title:result.title,description:result.description};
}
export async function packUpdate(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  const old = await db().quizPack.findFirst({ where: { id: p.id, authorId: user.id }, include: { items: true } });
  if (!old) fail(404, "not_found", "Pack not found");
  const ids: string[] = p.quizIds ?? old.items.sort((a, b) => a.position - b.position).map(i => i.quizId);
  if (p.publication === "PUBLISHED" && p.confirm !== true) fail(400, "confirmation_required", "Confirm publishing the pack");
  await validatePackQuestions(ids, user.id, p.publication === "PUBLISHED" || (old.publication === "PUBLISHED" && p.publication !== "DRAFT"), old.sourceLocale);
  const updated = await db().$transaction(async tx => {
    if (p.quizIds) {
      await tx.packQuestion.deleteMany({ where: { packId: old.id } });
      await tx.packQuestion.createMany({ data: ids.map((quizId, position) => ({ packId: old.id, quizId, position: position + 1 })) });
    }
    const pack = await tx.quizPack.update({ where: { id: old.id },
      data: { ...(p.title !== undefined ? { title: p.title } : {}),
        ...(p.description !== undefined ? { description: p.description } : {}),
        ...(p.publication ? { publication: p.publication } : {}) } });
    await tx.quizPackLocalization.updateMany({where:{packId:pack.id,locale:pack.sourceLocale},
      data:{...(p.title !== undefined ? {title:p.title}:{}),
        ...(p.description !== undefined ? {description:p.description}:{}),
        ...(p.publication?{status:p.publication}:{})}});
    await tx.auditLog.create({ data: { actorId: user.id, action: "pack.update", objectId: pack.id } });
    return pack;
  });
  return { id: updated.id, title: updated.title, publication: updated.publication, quizIds: ids };
}
