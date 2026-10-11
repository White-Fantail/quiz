import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "./db";
export class PlatformError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}
export function fail(status: number, code: string, message: string): never { throw new PlatformError(status, code, message); }
export type Actor = { id: string; role: string; displayName: string; leaderboardEligible: boolean };
let remoteKeys: ReturnType<typeof createRemoteJWKSet> | undefined;
export async function actorFor(request: Request): Promise<Actor | null> {
  const header = request.headers.get("authorization");
  if (!header) return null;
  if (!header.startsWith("Bearer ")) fail(401, "invalid_token", "Bearer token required");
  const issuer = process.env.OIDC_ISSUER;
  const audience = process.env.OIDC_AUDIENCE;
  const jwks = process.env.OIDC_JWKS_URL;
  if (!issuer || !audience || !jwks) fail(503, "auth_unconfigured", "OIDC provider is not configured");
  try {
    remoteKeys ??= createRemoteJWKSet(new URL(jwks));
    const { payload } = await jwtVerify(header.slice(7), remoteKeys, { issuer, audience, algorithms: ["RS256", "ES256", "EdDSA"] });
    if (!payload.sub) fail(401, "invalid_token", "Token has no subject");
    const id = createHash("sha256").update(issuer + ":" + payload.sub).digest("hex");
    const displayName = typeof payload.name === "string" ? payload.name.trim().slice(0, 60) : "Clupio Player";
    return db().user.upsert({
      where: { id },
      create: { id, issuer, subject: payload.sub, displayName },
      update: {},
      select: { id: true, role: true, displayName: true, leaderboardEligible: true }
    });
  } catch (e) {
    if (e instanceof PlatformError) throw e;
    fail(401, "invalid_token", "Access token is invalid or expired");
  }
}
export function requireActor(actor: Actor | null): Actor {
  if (!actor) return fail(401, "authentication_required", "Please sign in");
  return actor;
}
