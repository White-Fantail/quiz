import { ZodError } from "zod";
import { actorFor, requireSameOrigin, PlatformError } from "../../../../src/modules/platform/auth";
import { execute } from "../../../../src/modules/platform/operations";
import type { Operation } from "../../../../src/modules/platform/contracts";

export const runtime = "nodejs";
type Context = { params: Promise<{ segments: string[] }> };
type Match = { op: Operation; args: Record<string, unknown> };

function route(method: string, segments: string[]): Match | null {
  const [a, b, c, d] = segments;
  if (a === "catalog" && method === "GET" && !b) return { op: "catalog", args: {} };
  if (a === "topics" && !b && method === "GET") return { op: "topic_list", args: {} };
  if (a === "quizzes") {
    if (!b && method === "GET") return { op: "quiz_list", args: {} };
    if (!b && method === "POST") return { op: "quiz_create", args: {} };
    if (b && !c && method === "GET") return { op: "quiz_get", args: { id: b } };
    if (b && !c && method === "PATCH") return { op: "quiz_update", args: { id: b } };
    if (b && c === "suspend" && method === "POST") return { op: "weekly_suspend", args: { challengeId:b } };
    if (b && c === "review" && method === "GET") return { op: "quiz_review_get", args: { id:b } };
    if (b && c === "review" && method === "POST") return { op: "quiz_review", args: { id:b } };
    if (b && c === "language" && !d && method === "POST") return { op: "quiz_language_set", args: { id: b } };
    if (b && c === "publish" && method === "POST") return { op: "quiz_publish", args: { id: b } };
    if (b && c === "clues" && method === "PUT") return { op: "clues_replace", args: { id: b } };
    if (b && c === "stats" && method === "GET") return { op: "quiz_stats", args: { quizId: b } };
    if (b && c === "reviews" && method === "GET") return { op: "reviews_list", args: { quizId: b } };
    if (b && c === "reviews" && method === "POST") return { op: "review_upsert", args: { quizId: b } };
    if (b && c === "reviews" && method === "DELETE") return { op: "review_remove", args: { quizId: b } };
    if (b && c === "reports" && method === "POST") return { op: "report_create", args: { quizId: b } };
  }
  if (a === "packs" && !b) {
    if (method === "GET") return { op: "pack_list", args: {} };
    if (method === "POST") return { op: "pack_create", args: {} };
  }
  if (a === "packs" && b && c === "language" && !d && method === "POST") return { op: "pack_language_set", args: { id: b } };
  if (a === "packs" && b && !c && method === "PATCH") return { op: "pack_update", args: { id: b } };
  if (a === "weekly") {
    if (b === "current" && !c && method === "GET") return { op: "weekly_current", args: {} };
    if (b === "proposals" && !c && method === "GET") return { op: "weekly_proposals", args: {} };
    if (b === "submit" && !c && method === "POST") return { op: "weekly_submit", args: {} };
    if (b && c === "publish" && method === "POST") return { op: "weekly_publish", args: { challengeId:b } };
    if (b && c === "standings" && method === "GET") return { op: "weekly_standings", args: { challengeId:b } };
  }
  if (a === "runs") {
    if (!b && method === "POST") return { op: "run_start", args: {} };
    if (!b && method === "GET") return { op: "run_history", args: {} };
    if (b && c === "current" && method === "POST") return { op: "run_current", args: { runId:b } };
    if (b && c === "finish" && method === "POST") return { op: "run_finish", args: { runId:b } };
    if (b && c === "feedback" && method === "POST") return { op: "run_feedback", args: { runId:b } };
  }
  if (a === "play" && !b && method === "POST") return { op: "play_start", args: {} };
  if (a === "play" && b && c === "clue" && method === "POST") return { op: "play_clue", args: { sessionId: b } };
  if (a === "play" && b && c === "guess" && method === "POST") return { op: "play_guess", args: { sessionId: b } };
  if (a === "media") {
    if (!b && method === "GET") return { op: "media_list", args: {} };
    if (b === "upload" && !c && method === "POST") return { op: "media_upload", args: {} };
    if (b === "import" && !c && method === "POST") return { op: "media_import", args: {} };
    if (b && !c && method === "GET") return { op: "media_get", args: { id: b } };
    if (b && !c && method === "PATCH") return { op: "media_update", args: { id: b } };
    if (b && !c && method === "DELETE") return { op: "media_delete", args: { id: b } };
    if (b && c === "chunk" && method === "POST") return { op: "media_chunk", args: { id: b } };
    if (b && c === "complete" && method === "POST") return { op: "media_complete", args: { id: b } };
    if (b && c === "transform" && method === "POST") return { op: "media_transform", args: { id: b } };
    if (b && c === "review" && method === "GET") return { op: "media_review_get", args: { id: b } };
    if (b && c === "review" && method === "POST") return { op: "media_review", args: { id: b } };
  }
  if (a === "play" && b && c === "media" && method === "POST") return { op: "play_media", args: { sessionId: b } };
  if (a === "me" && b === "ranking" && method === "PATCH") return { op: "ranking_optin", args: {} };
  if (a === "me" && b === "locale" && !c && method === "GET") return { op: "locale_get", args: {} };
  if (a === "me" && b === "locale" && !c && method === "PATCH") return { op: "locale_update", args: {} };
  if (a === "admin" && b === "verify-adult" && !c && method === "POST") return { op: "adult_verify", args: {} };
  if (a === "me" && !b && method === "GET") return { op: "me", args: {} };
  if (a === "me" && b === "quizzes" && c && d === "insights" && method === "GET") return { op: "my_quiz_insights", args: { quizId: c } };
  if (a === "me" && b === "quizzes" && !c && method === "GET") return { op: "my_quizzes", args: {} };
  if (a === "me" && b === "stats" && method === "GET") return { op: "my_stats", args: {} };
  if (a === "reports" && b === "mine" && method === "GET") return { op: "reports_mine", args: {} };
  if (a === "leaderboard" && !b && method === "GET") return { op: "leaderboard", args: {} };
  if (a === "users" && b && !c && method === "GET") return { op: "user_get", args: { userId: b } };
  if (a === "users" && b && c === "reviews" && method === "GET") return { op: "creator_reviews_list", args: { userId: b } };
  if (a === "users" && b && c === "reviews" && method === "POST") return { op: "creator_review_upsert", args: { userId: b } };
  return null;
}
export function parseQuery(query: URLSearchParams): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of query) {
    if (["limit", "offset", "version"].includes(key)) values[key] = Number(value);
    else if (["mine", "kids"].includes(key)) values[key] = value === "true";
    else values[key] = value;
  }
  return values;
}
export async function handle(request: Request, context: Context): Promise<Response> {
  try {
    const { segments } = await context.params;
    const match = route(request.method, segments);
    if (!match) return Response.json({ error: "not_found" }, { status: 404 });
    const url = new URL(request.url);
    const size = Number(request.headers.get("content-length") ?? 0);
    if (size > 1000000) return Response.json({ error: "too_large" }, { status: 413 });
    const body = request.method === "GET" ? parseQuery(url.searchParams) : await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "invalid_body" }, { status: 400 });
    requireSameOrigin(request);
    const actor = await actorFor(request);
    const result = await execute(match.op, { ...body, ...match.args }, actor);
    return Response.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PlatformError)
      return Response.json({ error: error.code, message: error.message }, { status: error.status });
    if (error instanceof ZodError)
      return Response.json({ error: "validation_error", issues: error.issues }, { status: 400 });
    console.error("API request failed", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
