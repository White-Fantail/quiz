import { createHmac } from "node:crypto";

/**
 * Temporary, secret-free OAuth incident tracing.
 *
 * The diagnostic window ends automatically on 16 Oct 2026 UTC and may be
 * disabled immediately with MCP_OAUTH_TRACE_DISABLED=true.
 * Never log raw tokens, authorization codes, PKCE verifiers, cookies, URLs,
 * user identity, client IDs, refresh tokens, or response bodies.
 */
export const MCP_OAUTH_TRACE_END = "2026-10-16T00:00:00.000Z";

export function mcpOAuthTraceEnabled(now = Date.now()): boolean {
  return now < Date.parse(MCP_OAUTH_TRACE_END)
    && process.env.MCP_OAUTH_TRACE_DISABLED !== "true";
}

function fingerprint(token: string): string | null {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || token.length < 16) return null;
  // A keyed digest is not an OAuth credential. It lets issuance and rejection
  // logs be correlated without ever recording the bearer value.
  return createHmac("sha256", secret)
    .update("quizdip:mcp-oauth-trace:v1:")
    .update(token)
    .digest("hex").slice(0, 24);
}

function summarizeResource(values: string[], expected: string) {
  return {
    resourceProvided: values.length > 0,
    resourceCount: Math.min(values.length, 10),
    resourceMatchesMcp: values.includes(expected),
    resourceContainsOther: values.some(value => value !== expected),
  };
}

function scoped(value: unknown): boolean | null {
  if (typeof value === "string") return value.split(/\s+/).includes("mcp:tools");
  if (Array.isArray(value) && value.every(v => typeof v === "string"))
    return value.includes("mcp:tools");
  return null;
}

function tokenShape(token: string, expected: string, issuer: string) {
  const jwtLike = token.length <= 8192 &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
  const result: {
    tokenFormat: "jwt" | "opaque_or_other";
    tokenFingerprint: string | null;
    jwtAudienceMatches: boolean | null;
    jwtIssuerMatches: boolean | null;
    jwtHasMcpScope: boolean | null;
    jwtExpired: boolean | null;
    jwtTypeAccessToken: boolean | null;
  } = {
    tokenFormat: jwtLike ? "jwt" : "opaque_or_other",
    tokenFingerprint: fingerprint(token),
    jwtAudienceMatches: null,
    jwtIssuerMatches: null,
    jwtHasMcpScope: null,
    jwtExpired: null,
    jwtTypeAccessToken: null,
  };
  if (!jwtLike) return result;
  try {
    const [headerPart, claimsPart] = token.split(".");
    const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8")) as Record<string, unknown>;
    const claims = JSON.parse(Buffer.from(claimsPart, "base64url").toString("utf8")) as Record<string, unknown>;
    if (!header || !claims || Array.isArray(header) || Array.isArray(claims))
      return result;
    const aud = claims.aud;
    result.jwtAudienceMatches = typeof aud === "string" ? aud === expected :
      Array.isArray(aud) && aud.every(v => typeof v === "string") ? aud.includes(expected) : null;
    result.jwtIssuerMatches = typeof claims.iss === "string" ? claims.iss === issuer : null;
    result.jwtHasMcpScope = scoped(claims.scope ?? claims.scp);
    result.jwtExpired = typeof claims.exp === "number" && Number.isFinite(claims.exp)
      ? claims.exp <= Date.now() / 1000 : null;
    result.jwtTypeAccessToken = typeof header.typ === "string" ? header.typ.toLowerCase() === "at+jwt" : null;
  } catch {
    // Unverified token shape only. Never log a parser error or token bytes.
  }
  return result;
}

type TraceRequest = {
  phase: "authorize" | "token";
  resourceProvided: boolean;
  resourceCount: number;
  resourceMatchesMcp: boolean;
  resourceContainsOther: boolean;
  requestedMcpScope: boolean | null;
  grantType?: "authorization_code" | "refresh_token" | "client_credentials" | "other" | "absent";
};

/** Inspect only allowlisted OAuth fields; leave the original Request unchanged. */
export async function summarizeOAuthRequest(
  request: Request,
  phase: "authorize" | "token",
  expected: string,
): Promise<TraceRequest> {
  let resources: string[] = [];
  let scope: string | null = null;
  let grantType: TraceRequest["grantType"] = "absent";
  if (phase === "authorize") {
    const params = new URL(request.url).searchParams;
    resources = params.getAll("resource");
    scope = params.get("scope");
  } else {
    // OAuth token exchanges contain credentials; inspect only small encoded
    // bodies, and never emit their contents.
    const contentType = request.headers.get("content-type") || "";
    const size = Number(request.headers.get("content-length") || "0");
    if (contentType.includes("application/x-www-form-urlencoded") && size <= 16_384) {
      try {
        const raw = await request.clone().text();
        if (raw.length <= 16_384) {
          const params = new URLSearchParams(raw);
          resources = params.getAll("resource");
          scope = params.get("scope");
          const value = params.get("grant_type");
          grantType = value === "authorization_code" || value === "refresh_token" || value === "client_credentials"
            ? value : value ? "other" : "absent";
        }
      } catch {
        // Do not interrupt the OAuth flow because logging fails.
      }
    }
  }
  return { phase, ...summarizeResource(resources, expected), requestedMcpScope: scoped(scope), ...(phase === "token" ? { grantType } : {}) };
}

/** Emit a narrowly scoped response summary. Never read or modify the live response. */
export async function summarizeOAuthResponse(response: Response, phase: "authorize" | "token", expected: string, issuer: string) {
  const summary: Record<string, unknown> = { status: response.status };
  if (phase !== "token") return summary;
  // Only token endpoint response is relevant, and only JSON under 16KB.
  const size = Number(response.headers.get("content-length") || "0");
  if (size > 16_384 || !response.headers.get("content-type")?.includes("application/json")) return summary;
  try {
    const raw = await response.clone().text();
    if (raw.length > 16_384) return summary;
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) return summary;
    const data = body as Record<string, unknown>;
    if (typeof data.access_token === "string") {
      Object.assign(summary, tokenShape(data.access_token, expected, issuer));
      summary.grantedMcpScope = scoped(data.scope);
      summary.refreshTokenIssued = typeof data.refresh_token === "string";
      summary.tokenType = data.token_type === "DPoP" ? "DPoP" : data.token_type === "Bearer" ? "Bearer" : "other_or_absent";
    } else if (typeof data.error === "string") {
      // Emit only a fixed OAuth error category, not an arbitrary message.
      summary.oauthError = [
        "invalid_request", "invalid_client", "invalid_grant", "invalid_scope",
        "invalid_target", "unauthorized_client", "unsupported_grant_type",
      ].includes(data.error) ? data.error : "other";
    }
  } catch {
    // Diagnostic failures must not affect authorization.
  }
  return summary;
}

/** Request-side fingerprint matches the one emitted by the token endpoint. */
export function summarizeMcpBearer(request: Request, expected: string, issuer: string) {
  const raw = request.headers.get("authorization") || "";
  const bearer = /^Bearer\s+([^\s]+)$/i.exec(raw);
  return {
    authorizationKind: bearer ? "bearer" : raw ? "other_or_malformed" : "missing",
    ...(bearer ? tokenShape(bearer[1], expected, issuer) : {}),
    dpopProofProvided: request.headers.has("dpop"),
  };
}
