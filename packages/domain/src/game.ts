import type { QuizQuestion } from "./quiz.ts";

/** Demo/authoring helper only. Real games must validate guesses on the server. */
export function normalizeAnswer(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function isCorrectAnswer(
  answer: QuizQuestion["answer"],
  guess: string,
): boolean {
  const normalized = normalizeAnswer(guess);
  return (
    normalized.length > 0 &&
    [answer.canonical, ...answer.aliases].some(
      (candidate) => normalizeAnswer(candidate) === normalized,
    )
  );
}

/** A sample score model. Future game modes may provide their own rules. */
export function scoreForClues(clueCount: number, cluesUsed: number): number {
  if (!Number.isInteger(clueCount) || clueCount < 1) return 0;
  if (!Number.isInteger(cluesUsed) || cluesUsed < 1) return 0;
  const used = Math.min(cluesUsed, clueCount);
  return Math.max(20, 100 - (used - 1) * (80 / Math.max(1, clueCount - 1)));
}
