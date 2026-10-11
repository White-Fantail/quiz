import { demoQuiz } from "./demo-quiz.ts";
import type { QuizQuestion } from "@quizdip/domain";

/**
 * Tiny read-only service for the scaffold's demo endpoint.
 * A real QuizService will use authenticated repositories and server-only answers.
 */
export type QuizSummary = Pick<QuizQuestion, "id" | "title" | "mode"> & {
  clueCount: number;
};

export function listDemoQuizSummaries(): QuizSummary[] {
  return [{
    id: demoQuiz.id,
    title: demoQuiz.title,
    mode: demoQuiz.mode,
    clueCount: demoQuiz.clues.length,
  }];
}
