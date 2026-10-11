import { NextResponse } from "next/server";
import { demoQuiz } from "../../../../src/data/demo-quiz";

/** Demo metadata only. Public production APIs must never leak answer data. */
export function GET() {
  return NextResponse.json({
    demo: true,
    message: "No persistent/public quiz catalog is available yet.",
    items: [
      {
        id: demoQuiz.id,
        title: demoQuiz.title,
        mode: demoQuiz.mode,
        clueCount: demoQuiz.clues.length,
      },
    ],
  });
}
