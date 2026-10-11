import { randomUUID } from "node:crypto";
import { db } from "./db";
import { fail, requireActor, type Actor } from "./auth";
import { validateMediaReferences } from "./media";

const defaultCategories: Record<string, string> = {
  "guess-animal": "animals", "guess-person": "people", "guess-place": "geography", "guess-thing": "general"
};
function normalizeClues(clues: any[]) {
  return clues.map((clue, i) => ({ ...clue, id: randomUUID(), order: i + 1 }));
}
async function revision(quizId: string, version: number) {
  const row = await db().quizRevision.findUnique({ where: { quizId_version: { quizId, version } } });
  if (!row) return fail(404, "not_found", "Quiz revision not found");
  return row;
}
export async function quizList(p: Record<string, any>, actor: Actor | null) {
  if (p.mine) requireActor(actor);
  const where: any = p.mine ? { authorId: actor!.id } : { publication: "PUBLISHED", safetyStatus: { not: "RESTRICTED" } };
  if (p.kids) Object.assign(where, { publication: "PUBLISHED", safetyStatus: "APPROVED", kidsEligible: true });
  const rows = await db().quiz.findMany({ where, orderBy: { updatedAt: "desc" }, skip: p.offset, take: p.limit });
  const items = await Promise.all(rows.map(async quiz => {
    const r = await revision(quiz.id, quiz.currentVersion);
    return { id: quiz.id, title: r.title, prompt: r.prompt, mode: r.mode, clueCount: (r.clues as any[]).length,
      version: quiz.currentVersion, publication: quiz.publication, categories: quiz.categories, safetyStatus: quiz.safetyStatus,
      kidsEligible: quiz.kidsEligible && quiz.safetyStatus === "APPROVED" };
  }));
  return { items, offset: p.offset, limit: p.limit };
}
export async function quizGet(id: string, actor: Actor | null) {
  const quiz = await db().quiz.findUnique({ where: { id } });
  if (!quiz) fail(404, "not_found", "Quiz not found");
  const owned = actor?.id === quiz.authorId;
  if (!owned && (quiz.publication !== "PUBLISHED" || quiz.safetyStatus === "RESTRICTED"))
    fail(404, "not_found", "Quiz not found");
  const r = await revision(id, quiz.currentVersion);
  return { id, title: r.title, prompt: r.prompt, mode: r.mode, clueCount: (r.clues as any[]).length, promptMediaIds: (owned ? r.promptMediaIds : undefined),
    version: quiz.currentVersion, publication: quiz.publication, categories: quiz.categories,
    creatorIntent: owned ? quiz.creatorIntent : undefined,
    recommendedAudience: quiz.recommendedAudience, safetyStatus: quiz.safetyStatus,
    kidsEligible: quiz.kidsEligible && quiz.safetyStatus === "APPROVED",
    ...(owned ? { answer: r.answer, clues: r.clues, authorId: quiz.authorId } : {}) };
}
export async function quizCreate(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  const count = await db().quiz.count({ where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - 86400000) } } });
  if (count >= 100) fail(429, "rate_limit", "Daily creation limit reached");
  await validateMediaReferences(user.id, p.promptMediaIds ?? [], p.clues);
  const quiz = await db().quiz.create({
    data: { authorId: user.id, categories: p.categories?.length ? p.categories : [defaultCategories[p.mode]],
      ...(p.creatorIntent ? { creatorIntent: p.creatorIntent } : {}),
      revisions: { create: { version: 1, title: p.title, prompt: p.prompt, mode: p.mode, answer: p.answer, clues: normalizeClues(p.clues), promptMediaIds: p.promptMediaIds ?? [] } } }
  });
  return quizGet(quiz.id, actor);
}
export async function quizUpdate(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  const old = await db().quiz.findUnique({ where: { id: p.id } });
  if (!old || old.authorId !== user.id) fail(404, "not_found", "Quiz not found");
  if (p.expectedVersion !== old.currentVersion) fail(409, "version_conflict", "Refresh quiz and try again");
  const prior = await revision(old.id, old.currentVersion);
  const modified = ["title", "prompt", "mode", "answer", "clues", "promptMediaIds"].some(key => p[key] !== undefined);
  const nextClues = (p.clues ?? prior.clues) as any[];
  const nextPromptMediaIds = (p.promptMediaIds ?? prior.promptMediaIds) as string[];
  await validateMediaReferences(user.id, nextPromptMediaIds, nextClues, old.publication === "PUBLISHED");
  if (old.safetyStatus === "RESTRICTED")
    fail(403, "restricted_quiz", "Restricted quizzes require trusted moderation clearance");
  await db().$transaction(async tx => {
    const changed = await tx.quiz.updateMany({
      where: { id: old.id, authorId: user.id, currentVersion: p.expectedVersion },
      data: { currentVersion: { increment: 1 }, safetyStatus: "PENDING", kidsEligible: false,
        ...(p.categories ? { categories: p.categories } : {}),
        ...(p.creatorIntent ? { creatorIntent: p.creatorIntent } : {}) }
    });
    if (changed.count !== 1) fail(409, "version_conflict", "Quiz changed while editing");
    await tx.quizRevision.create({ data: { quizId: old.id, version: p.expectedVersion + 1,
      title: p.title ?? prior.title, prompt: p.prompt ?? prior.prompt, mode: p.mode ?? prior.mode,
      answer: (p.answer ?? prior.answer) as any, clues: (p.clues ? normalizeClues(p.clues) : prior.clues) as any,
      promptMediaIds: nextPromptMediaIds as any } });
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
  const currentRevision = await revision(old.id, old.currentVersion);
  await validateMediaReferences(user.id, currentRevision.promptMediaIds as string[], currentRevision.clues as any[], true);
  if (old.publication !== "PUBLISHED") {
    const recent = await db().auditLog.count({ where: { actorId: user.id, action: "quiz.publish", createdAt: { gte: new Date(Date.now() - 86400000) } } });
    if (recent >= 30) fail(429, "rate_limit", "Daily publication limit reached");
  }
  await db().$transaction(async tx => {
    await tx.quiz.update({ where: { id: old.id }, data: { publication: "PUBLISHED", kidsEligible: false, safetyStatus: "PENDING" } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "quiz.publish", objectId: old.id } });
  });
  return { id: old.id, publication: "PUBLISHED", kidsEligibility: "PENDING_REVIEW" };
}

/** Trusted moderator action. Creators cannot change safety or Kids eligibility. */
export async function quizReview(p: Record<string,any>,actor:Actor|null) {
  const admin=requireActor(actor);
  if(admin.role!=="ADMIN") fail(403,"admin_required","Only trusted staff can review a quiz");
  const quiz=await db().quiz.findUnique({where:{id:p.id}});
  if(!quiz) fail(404,"not_found","Quiz was not found");
  if(p.kidsEligible && p.verdict!=="APPROVED")
    fail(422,"invalid_safety","Kids eligibility requires an APPROVED safety verdict");
  if(p.verdict==="APPROVED" || p.kidsEligible) {
    const revision=await db().quizRevision.findUnique({where:{
      quizId_version:{quizId:quiz.id,version:quiz.currentVersion}
    }});
    if(!revision) fail(409,"invalid_revision","Quiz revision missing");
    await validateMediaReferences(quiz.authorId,revision.promptMediaIds as string[],revision.clues as any[],true);
  }
  const updated=await db().$transaction(async tx=>{
    // Do not approve an unseen newer revision if its creator edits concurrently.
    const changed=await tx.quiz.updateMany({where:{id:quiz.id,currentVersion:quiz.currentVersion},
      data:{safetyStatus:p.verdict,kidsEligible:p.verdict==="APPROVED"&&p.kidsEligible}});
    if(changed.count!==1) fail(409,"revision_conflict","Quiz changed during moderation. Review again");
    await tx.auditLog.create({data:{actorId:admin.id,action:"quiz.review",objectId:quiz.id,
      detail:{verdict:p.verdict,kidsEligible:p.kidsEligible,reason:p.reason,version:quiz.currentVersion}}});
    return {id:quiz.id,safetyStatus:p.verdict,kidsEligible:p.verdict==="APPROVED"&&p.kidsEligible,
      currentVersion:quiz.currentVersion};
  });
  return {id:updated.id,safetyStatus:updated.safetyStatus,kidsEligible:updated.kidsEligible,
    version:updated.currentVersion};
}

export async function quizReviewGet(p:Record<string,any>,actor:Actor|null) {
  const admin=requireActor(actor);
  if(admin.role!=="ADMIN") fail(403,"admin_required","Quiz review details require administrator authority");
  const item=await db().quiz.findUnique({where:{id:p.id}});
  if(!item) fail(404,"not_found","Quiz not found");
  const current=await db().quizRevision.findUnique({where:{quizId_version:{quizId:item.id,version:item.currentVersion}}});
  if(!current) fail(409,"invalid_revision","Quiz revision unavailable");
  return {id:item.id,authorId:item.authorId,version:item.currentVersion,
    title:current.title,prompt:current.prompt,mode:current.mode,answer:current.answer,
    clues:current.clues,promptMediaIds:current.promptMediaIds,creatorIntent:item.creatorIntent,
    safetyStatus:item.safetyStatus,kidsEligible:item.kidsEligible,publication:item.publication};
}
