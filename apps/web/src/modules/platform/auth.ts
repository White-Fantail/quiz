import { hasKidCookie } from "../kids/credentials";
import { auth, authPool, siteOrigin } from "../../lib/auth";
import { db } from "./db";

export class PlatformError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}
export function fail(status: number, code: string, message: string): never { throw new PlatformError(status, code, message); }
export type Actor = { id: string; role: string; displayName: string; leaderboardEligible: boolean; leaderboardOptIn: boolean };

/**
 * Resolve *only* a Better Auth user identifier obtained from a validated
 * session or a resource-bound MCP access token. Never accept client-supplied IDs.
 */
export async function actorByIdentity(id: string): Promise<Actor> {
  if (!id || id.length > 200) fail(401, "invalid_identity", "Invalid account identity");
  const identity = await authPool().query<{ name: string }>(
    'SELECT "name" FROM "user" WHERE "id" = $1 LIMIT 1',
    [id],
  );
  if (!identity.rows[0]) fail(401, "invalid_identity", "Account does not exist");
  return db().user.upsert({
    where: { id },
    create: {
      id,
      issuer: "better-auth",
      subject: id,
      displayName: (identity.rows[0].name || "QuizDip Player").slice(0, 60),
    },
    update: {},
    select: { id: true, role: true, displayName: true, leaderboardEligible: true, leaderboardOptIn: true },
  });
}

/** REST uses the verified same-site login cookie; OAuth Bearer tokens are for MCP only. */
export async function actorFor(request: Request): Promise<Actor | null> {
  if (hasKidCookie(request.headers.get("cookie")))
    fail(403,"kid_mode_active","Unlock Kids before accessing the adult account");
  // Never silently interpret a failed bearer as an authenticated browser session.
  if (request.headers.has("authorization")) {
    fail(401, "unsupported_credentials", "Use an authenticated web session for REST or OAuth for MCP");
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return null;
  return actorByIdentity(session.user.id);
}

export function requireSameOrigin(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(siteOrigin).origin)
    fail(403, "invalid_origin", "A same-origin request is required");
}
export function requireActor(actor: Actor | null): Actor {
  if (!actor) return fail(401, "authentication_required", "Please sign in");
  return actor;
}
