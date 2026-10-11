import { db } from "./db";
import { fail, requireActor, type Actor } from "./auth";

async function getPublicQuiz(quizId: string) {
  const q = await db().quiz.findUnique({ where: { id: quizId } });
  if (!q || q.publication !== "PUBLISHED" || q.safetyStatus === "RESTRICTED")
    fail(404, "not_found", "Published quiz not found");
  return q;
}
export async function reviewsList(p: Record<string, any>) {
  await getPublicQuiz(p.quizId);
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
  return { id: review.id, rating: review.rating, comment: review.comment, updatedAt: review.updatedAt };
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
async function validatePackQuestions(ids: string[], authorId: string, publish = false) {
  if (new Set(ids).size !== ids.length) fail(400, "duplicate_quiz", "Pack questions must be unique");
  const qs = await db().quiz.findMany({ where: { id: { in: ids } } });
  if (qs.length !== ids.length || qs.some(q => (q.authorId !== authorId && q.publication !== "PUBLISHED") ||
    q.safetyStatus === "RESTRICTED" || (publish && q.publication !== "PUBLISHED")))
    fail(400, "invalid_pack", "Pack has unavailable or unpublished questions");
}
export async function packCreate(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  await validatePackQuestions(p.quizIds, user.id);
  const pack = await db().quizPack.create({
    data: { authorId: user.id, title: p.title, description: p.description,
      items: { create: p.quizIds.map((quizId: string, index: number) => ({ quizId, position: index + 1 })) } },
    include: { items: { orderBy: { position: "asc" } } }
  });
  return pack;
}
export async function packList(p: Record<string, any>, actor: Actor | null) {
  if (p.mine) requireActor(actor);
  const packs = await db().quizPack.findMany({
    where: p.mine ? { authorId: actor!.id } : { publication: "PUBLISHED" },
    orderBy: { updatedAt: "desc" }, skip: p.offset, take: p.limit,
    include: { items: { orderBy: { position: "asc" } } }
  });
  return { items: packs.map(pack => ({ id: pack.id, title: pack.title, description: pack.description,
    publication: pack.publication, quizIds: pack.items.map(item => item.quizId) })) };
}
export async function packUpdate(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  const old = await db().quizPack.findFirst({ where: { id: p.id, authorId: user.id }, include: { items: true } });
  if (!old) fail(404, "not_found", "Pack not found");
  const ids: string[] = p.quizIds ?? old.items.sort((a, b) => a.position - b.position).map(i => i.quizId);
  if (p.publication === "PUBLISHED" && p.confirm !== true) fail(400, "confirmation_required", "Confirm publishing the pack");
  await validatePackQuestions(ids, user.id, p.publication === "PUBLISHED" || (old.publication === "PUBLISHED" && p.publication !== "DRAFT"));
  const updated = await db().$transaction(async tx => {
    if (p.quizIds) {
      await tx.packQuestion.deleteMany({ where: { packId: old.id } });
      await tx.packQuestion.createMany({ data: ids.map((quizId, position) => ({ packId: old.id, quizId, position: position + 1 })) });
    }
    const pack = await tx.quizPack.update({ where: { id: old.id },
      data: { ...(p.title !== undefined ? { title: p.title } : {}),
        ...(p.description !== undefined ? { description: p.description } : {}),
        ...(p.publication ? { publication: p.publication } : {}) } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "pack.update", objectId: pack.id } });
    return pack;
  });
  return { id: updated.id, title: updated.title, publication: updated.publication, quizIds: ids };
}
