import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isCorrectAnswer, scoreForClues } from "@clupio/domain";
import { db } from "./db";
import { fail, type Actor } from "./auth";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
async function getSession(p: Record<string, any>, actor: Actor | null) {
  const session = await db().playSession.findUnique({
    where: { id: p.sessionId },
    include: { revision: true }
  });
  if (!session) fail(404, "not_found", "Session not found");
  const provided = Buffer.from(hashToken(p.sessionToken), "hex");
  const expected = Buffer.from(session.tokenHash, "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected))
    fail(403, "forbidden", "Invalid session capability");
  if (session.userId && session.userId !== actor?.id) fail(403, "forbidden", "Session belongs to another account");
  if (session.expiresAt.getTime() < Date.now()) fail(410, "session_expired", "Start another game");
  return session;
}
export async function playStart(p: Record<string, any>, actor: Actor | null) {
  const quiz = await db().quiz.findUnique({ where: { id: p.quizId } });
  if (!quiz || quiz.publication !== "PUBLISHED" || quiz.safetyStatus === "RESTRICTED")
    fail(404, "not_found", "Quiz unavailable");
  if (p.kids && !(quiz.safetyStatus === "APPROVED" && quiz.kidsEligible))
    fail(403, "not_for_kids", "Quiz has not passed Kids eligibility checks");
  const revision = await db().quizRevision.findUnique({ where: { quizId_version: { quizId: quiz.id, version: quiz.currentVersion } } });
  if (!revision) fail(404, "not_found", "Quiz version unavailable");
  const clues = revision.clues as Record<string, unknown>[];
  if (!clues.length) fail(409, "invalid_quiz", "Quiz has no clues");
  const token = randomBytes(32).toString("base64url");
  const session = await db().playSession.create({ data: {
    quizId: quiz.id, revisionId: revision.id, userId: actor?.id, tokenHash: hashToken(token),
    usedClues: 1, expiresAt: new Date(Date.now() + 3600000)
  } });
  return { sessionId: session.id, sessionToken: token, title: revision.title, prompt: revision.prompt,
    mode: revision.mode, quizVersion: revision.version, clue: clues[0], clueIndex: 1, clueCount: clues.length };
}
export async function playClue(p: Record<string, any>, actor: Actor | null) {
  const session = await getSession(p, actor);
  if (session.status !== "ACTIVE") fail(409, "finished", "Game has already ended");
  const clues = session.revision.clues as Record<string, unknown>[];
  if (session.usedClues >= clues.length) fail(409, "no_more_clues", "No more clues available");
  const updated = await db().playSession.updateMany({
    where: { id: session.id, status: "ACTIVE", usedClues: session.usedClues, wrongGuesses: session.wrongGuesses },
    data: { usedClues: { increment: 1 } }
  });
  if (updated.count !== 1) fail(409, "conflict", "Concurrent session action, retry");
  return { sessionId: session.id, clue: clues[session.usedClues], clueIndex: session.usedClues + 1,
    clueCount: clues.length, remaining: clues.length - (session.usedClues + 1) };
}
export async function playGuess(p: Record<string, any>, actor: Actor | null) {
  const session = await getSession(p, actor);
  if (session.status !== "ACTIVE") fail(409, "finished", "Game has already ended");
  if (session.wrongGuesses >= session.usedClues) fail(429, "reveal_next_clue", "Reveal another clue before trying again");
  const clues = session.revision.clues as unknown[];
  const answer = session.revision.answer as { canonical: string; aliases: string[] };
  const correct = isCorrectAnswer(answer, p.guess);
  const last = session.usedClues === clues.length;
  const failed = !correct && last;
  const score = correct ? Math.round(scoreForClues(clues.length, session.usedClues)) : 0;
  const updated = await db().playSession.updateMany({
    where: { id: session.id, status: "ACTIVE", wrongGuesses: session.wrongGuesses, usedClues: session.usedClues },
    data: { wrongGuesses: correct ? session.wrongGuesses : session.usedClues,
      ...(correct || failed ? { status: correct ? "SOLVED" : "FAILED", score, finishedAt: new Date() } : {}) }
  });
  if (updated.count !== 1) fail(409, "conflict", "Concurrent session action, retry");
  return {
    status: correct ? "SOLVED" : failed ? "FAILED" : "ACTIVE", correct, score, cluesUsed: session.usedClues,
    ...(correct || failed ? { answer: answer.canonical } : { next: "Reveal the next clue" })
  };
}
