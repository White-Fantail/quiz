import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isCorrectAnswer, scoreForClues } from "@quizdip/domain";
import { db } from "./db";
import { ratingsForQuiz, myRatingForQuiz, ratingAccess } from "./ratings";
import { fail, type Actor } from "./auth";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export async function getPlaySession(p: Record<string, any>, actor: Actor | null) {
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
  if (session.runId) {
    const run=await db().playRun.findUnique({where:{id:session.runId},include:{weekly:true}});
    if (!run || run.status!=="ACTIVE" || run.currentIndex!==session.roundIndex ||
        (run.mode==="WEEKLY" && run.weekly?.status!=="SCHEDULED"))
      fail(409,"run_not_active","This run's active round has changed");
    const quiz=await db().quiz.findUnique({where:{id:session.quizId}});
    if (!quiz || quiz.publication!=="PUBLISHED" || quiz.safetyStatus==="RESTRICTED" ||
      (run.lane==="KIDS" && !(quiz.safetyStatus==="APPROVED"&&quiz.kidsEligible)))
      fail(409,"question_suspended","This quiz is unavailable for the chosen audience");
  }
  return session;
}
export async function playStart(p: Record<string, any>, actor: Actor | null) {
  const featured=await db().weeklyQuestion.findFirst({where:{
    quizId:p.quizId,challenge:{status:"SCHEDULED",weekEnd:{gt:new Date()}}
  }});
  if(featured) fail(409,"weekly_reserved","Featured weekly questions are reserved for the shared five-round challenge");
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
  const [ratings,myRating]=await Promise.all([ratingsForQuiz(quiz.id),myRatingForQuiz(quiz.id,actor)]);
  return { sessionId: session.id, sessionToken: token, title: revision.title, prompt: revision.prompt,
    quizId:quiz.id,ratings,myRating,ratingAccess:ratingAccess(actor,quiz.authorId,session.userId),
    mode: revision.mode, quizVersion: revision.version, promptMediaIds: revision.promptMediaIds, clue: clues[0], clueIndex: 1, clueCount: clues.length };
}
export async function playClue(p: Record<string, any>, actor: Actor | null) {
  const session = await getPlaySession(p, actor);
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
  const session = await getPlaySession(p, actor);
  if (session.status !== "ACTIVE") fail(409, "finished", "Game has already ended");
  if (session.wrongGuesses >= session.usedClues) fail(429, "reveal_next_clue", "Reveal another clue before trying again");
  const clues = session.revision.clues as unknown[];
  const answer = session.revision.answer as { canonical: string; aliases: string[] };
  const correct = isCorrectAnswer(answer, p.guess);
  const last = session.usedClues === clues.length;
  const failed = !correct && last;
  const score = correct ? Math.round(scoreForClues(clues.length, session.usedClues)) : 0;
  const terminal=correct || failed;
  await db().$transaction(async tx => {
    const updated = await tx.playSession.updateMany({
      where: { id: session.id, status: "ACTIVE", wrongGuesses: session.wrongGuesses, usedClues: session.usedClues },
      data: { wrongGuesses: correct ? session.wrongGuesses : session.usedClues,
        ...(terminal ? { status: correct ? "SOLVED" : "FAILED", score, finishedAt: new Date() } : {}) }
    });
    if (updated.count !== 1) fail(409, "conflict", "Concurrent session action, retry");
    if (terminal && session.runId) {
      const run=await tx.playRun.findUnique({where:{id:session.runId}});
      if (!run || run.status!=="ACTIVE" || run.currentIndex!==session.roundIndex ||
          run.expiresAt.getTime()<=Date.now())
        fail(409,"run_conflict","This run has already moved to another round");
      const finished=run.mode!=="INFINITE" && run.currentIndex===4;
      const changed=await tx.playRun.updateMany({
        where:{id:run.id,status:"ACTIVE",currentIndex:run.currentIndex},
        data:{currentIndex:{increment:1},score:{increment:score},
          solved:{increment:correct?1:0},failed:{increment:failed?1:0},
          ...(finished?{status:"FINISHED",completedAt:new Date()}:{}),
        }
      });
      if(changed.count!==1) fail(409,"run_conflict","Run result was already counted");
    }
  });
  return {
    status: correct ? "SOLVED" : failed ? "FAILED" : "ACTIVE", correct, score, cluesUsed: session.usedClues,
    ...(correct || failed ? { answer: answer.canonical } : { next: "Reveal the next clue" })
  };
}
