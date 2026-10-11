import type { QuizQuestion } from "./quiz.ts";

/**
 * Eligibility guard only, NOT a safety analysis service.
 * A creator's claimed age range can never override this check.
 */
export function isEligibleForKids(
  quiz: Pick<QuizQuestion, "publication" | "platformSafety">,
): boolean {
  return (
    quiz.publication === "published" &&
    quiz.platformSafety.status === "approved"
  );
}
