import { NextResponse } from "next/server";
import { listDemoQuizSummaries } from "../../../../src/modules/quiz/service";

/** Demo metadata only. Never return correct answers from this endpoint. */
export function GET() {
  return NextResponse.json({
    demo: true,
    message: "No persistent/public quiz catalog is available yet.",
    items: listDemoQuizSummaries(),
  });
}
