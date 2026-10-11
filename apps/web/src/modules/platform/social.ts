import { db } from "./db";
import { ratingsForQuiz } from "./ratings";
import { fail, requireActor, type Actor } from "./auth";
import { playableQuizWhere } from "./content-locale";

async function getPublicQuiz(quizId: string) {
  const q = await db().quiz.findUnique({ where: { id: quizId } });
  if (!q || q.publication !== "PUBLISHED" || q.safetyStatus === "RESTRICTED")
    fail(404, "not_found", "Published quiz not found");
  return q;
}
export async function reviewsList(p: Record<string, any>) {
  await getPublicQuiz(p.quizId);
  const available = await db().quizLocalization.count({where:{quizId:p.quizId,locale:p.locale,status:"PUBLISHED"}});
  if (!available) fail(404,"locale_unavailable","Quiz not available in this language");
  const [items, count] = await Promise.all([
    db().review.findMany({ where: { quizId: p.quizId }, select: {
      id: true, rating: true, comment: true, createdAt: true,
      author: { select: { displayName: true } }
    }, orderBy: { createdAt: "desc" }, skip: p.offset, take: p.limit }),
    db().review.count({ where: { quizId: p.quizId } })
  ]);
  return { items, count };
}
export async function reviewUpsert(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  const quiz = await getPublicQuiz(p.quizId);
  if (quiz.authorId === user.id) fail(403, "self_review", "Creators cannot review their own quiz");
  const completed = await db().playSession.count({
    where: { quizId: p.quizId, userId: user.id, status: { in: ["SOLVED", "FAILED"] } }
  });
  if (!completed) fail(403, "play_required", "Finish this quiz before reviewing");
  const review = await db().review.upsert({
    where: { quizId_authorId: { quizId: p.quizId, authorId: user.id } },
    create: { quizId: p.quizId, authorId: user.id, rating: p.rating, comment: p.comment },
    update: { rating: p.rating, comment: p.comment }
  });
  return { id: review.id, rating: review.rating, comment: review.comment, updatedAt: review.updatedAt,
    ratings:await ratingsForQuiz(p.quizId) };
}
/** Clear an existing reaction without permitting other users to alter it. */
export async function reviewRemove(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  const deleted=await db().review.deleteMany({where:{quizId:p.quizId,authorId:user.id}});
  return {removed:deleted.count>0,rating:null,ratings:await ratingsForQuiz(p.quizId)};
}
export async function reportCreate(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  await getPublicQuiz(p.quizId);
  const recent = await db().report.count({
    where: { reporterId: user.id, createdAt: { gte: new Date(Date.now() - 86400000) } }
  });
  if (recent >= 10) fail(429, "rate_limit", "Daily report limit reached");
  const report = await db().report.create({
    data: { quizId: p.quizId, reporterId: user.id, reason: p.reason, detail: p.detail }
  });
  return { id: report.id, status: report.status, createdAt: report.createdAt };
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
