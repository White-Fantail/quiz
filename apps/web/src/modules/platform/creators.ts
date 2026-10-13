import { db } from "./db";
import { fail, requireActor, type Actor } from "./auth";

export async function userGet(p: Record<string, any>) {
  const user = await db().user.findUnique({ where: { id: p.userId }, select: { id: true, displayName: true } });
  if (!user) fail(404, "not_found", "Creator not found");
  const [publishedQuizzes, positive, negative] = await Promise.all([
    db().quiz.count({ where: { authorId: user.id, publication: "PUBLISHED", safetyStatus: "ACTIVE" } }),
    db().creatorReview.count({ where: { targetId: user.id, rating: 1 } }),
    db().creatorReview.count({ where: { targetId: user.id, rating: -1 } })
  ]);
  return { ...user, publishedQuizzes, reviews: { positive, negative } };
}
export async function creatorReviewsList(p: Record<string, any>) {
  await userGet({ userId: p.userId });
  const [items, count] = await Promise.all([
    db().creatorReview.findMany({
      where: { targetId: p.userId },
      select: { id: true, rating: true, comment: true, createdAt: true },
      orderBy: { createdAt: "desc" }, skip: p.offset, take: p.limit
    }),
    db().creatorReview.count({ where: { targetId: p.userId } })
  ]);
  return { items, count };
}
export async function creatorReviewUpsert(p: Record<string, any>, actor: Actor | null) {
  const reviewer = requireActor(actor);
  if (reviewer.id === p.userId) fail(403, "self_review", "Cannot rate yourself");
  const target = await db().user.findUnique({ where: { id: p.userId }, select: { id: true } });
  if (!target) fail(404, "not_found", "Creator not found");
  const completed = await db().playSession.count({
    where: { userId: reviewer.id, status: { in: ["SOLVED", "FAILED"] },
      quiz: { authorId: p.userId, publication: "PUBLISHED", safetyStatus: "ACTIVE" } }
  });
  if (!completed) fail(403, "play_required", "Finish one of this creator's published quizzes before reviewing");
  const review = await db().creatorReview.upsert({
    where: { targetId_reviewerId: { targetId: p.userId, reviewerId: reviewer.id } },
    create: { targetId: p.userId, reviewerId: reviewer.id, rating: p.rating, comment: p.comment },
    update: { rating: p.rating, comment: p.comment }
  });
  return { id: review.id, rating: review.rating, updatedAt: review.updatedAt };
}
