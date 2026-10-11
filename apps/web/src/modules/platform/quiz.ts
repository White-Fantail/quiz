import { randomUUID } from "node:crypto";
import { db } from "./db";
import { fail, requireActor, type Actor } from "./auth";

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
      version: quiz.currentVersion, publication: quiz.publication, categories: quiz.categories, safetyStatus: quiz.safetyStatus };
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
  return { id, title: r.title, prompt: r.prompt, mode: r.mode, clueCount: (r.clues as any[]).length,
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
  const quiz = await db().quiz.create({
    data: { authorId: user.id, categories: p.categories?.length ? p.categories : [defaultCategories[p.mode]],
      ...(p.creatorIntent ? { creatorIntent: p.creatorIntent } : {}),
      revisions: { create: { version: 1, title: p.title, prompt: p.prompt, mode: p.mode, answer: p.answer, clues: normalizeClues(p.clues) } } }
  });
  return quizGet(quiz.id, actor);
}
export async function quizUpdate(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  const old = await db().quiz.findUnique({ where: { id: p.id } });
  if (!old || old.authorId !== user.id) fail(404, "not_found", "Quiz not found");
  if (p.expectedVersion !== old.currentVersion) fail(409, "version_conflict", "Refresh quiz and try again");
  const prior = await revision(old.id, old.currentVersion);
  const modified = ["title", "prompt", "mode", "answer", "clues"].some(key => p[key] !== undefined);
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
      answer: (p.answer ?? prior.answer) as any, clues: (p.clues ? normalizeClues(p.clues) : prior.clues) as any } });
    await tx.auditLog.create({ data: { actorId: user.id, action: modified ? "quiz.edit" : "quiz.settings", objectId: old.id } });
  });
  return quizGet(old.id, actor);
}
export async function quizPublish(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  if (p.confirm !== true) fail(400, "confirmation_required", "User must confirm publishing");
  const old = await db().quiz.findFirst({ where: { id: p.id, authorId: user.id } });
  if (!old) fail(404, "not_found", "Quiz not found");
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
