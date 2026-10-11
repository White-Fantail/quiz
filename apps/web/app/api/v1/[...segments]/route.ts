import { ZodError } from "zod";
import { actorFor, requireSameOrigin, PlatformError } from "../../../../src/modules/platform/auth";
import { execute } from "../../../../src/modules/platform/operations";
import type { Operation } from "../../../../src/modules/platform/contracts";

export const runtime = "nodejs";
type Context = { params: Promise<{ segments: string[] }> };
type Match = { op: Operation; args: Record<string, unknown> };

function route(method: string, segments: string[]): Match | null {
  const [a, b, c] = segments;
  if (a === "catalog" && method === "GET" && !b) return { op: "catalog", args: {} };
  if (a === "quizzes") {
    if (!b && method === "GET") return { op: "quiz_list", args: {} };
    if (!b && method === "POST") return { op: "quiz_create", args: {} };
    if (b && !c && method === "GET") return { op: "quiz_get", args: { id: b } };
    if (b && !c && method === "PATCH") return { op: "quiz_update", args: { id: b } };
    if (b && c === "publish" && method === "POST") return { op: "quiz_publish", args: { id: b } };
    if (b && c === "clues" && method === "PUT") return { op: "clues_replace", args: { id: b } };
    if (b && c === "stats" && method === "GET") return { op: "quiz_stats", args: { quizId: b } };
    if (b && c === "reviews" && method === "GET") return { op: "reviews_list", args: { quizId: b } };
    if (b && c === "reviews" && method === "POST") return { op: "review_upsert", args: { quizId: b } };
    if (b && c === "reports" && method === "POST") return { op: "report_create", args: { quizId: b } };
  }
  if (a === "packs" && !b) {
    if (method === "GET") return { op: "pack_list", args: {} };
    if (method === "POST") return { op: "pack_create", args: {} };
  }
  if (a === "packs" && b && !c && method === "PATCH") return { op: "pack_update", args: { id: b } };
  if (a === "play" && !b && method === "POST") return { op: "play_start", args: {} };
  if (a === "play" && b && c === "clue" && method === "POST") return { op: "play_clue", args: { sessionId: b } };
  if (a === "play" && b && c === "guess" && method === "POST") return { op: "play_guess", args: { sessionId: b } };
  if (a === "me" && !b && method === "GET") return { op: "me", args: {} };
  if (a === "me" && b === "quizzes" && method === "GET") return { op: "my_quizzes", args: {} };
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
