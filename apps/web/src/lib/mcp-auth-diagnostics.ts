/**
 * Safe, bounded observability for failed authenticated MCP requests.
 *
 * Never emit bearer credentials, JWT contents, raw header values, user IDs,
 * client IDs, or OAuth error descriptions. Claim indicators are unverified:
 * only Better Auth decides whether a token is actually valid.
 */
type AuthHeaderKind = "missing" | "bearer" | "bearer_malformed" | "other_scheme";
type JwtSignal = "not_jwt" | "jwt_unreadable" | "jwt_structured";

type JwtIndicators = {
  jwtSignal: JwtSignal;
  audienceMatchesResource: boolean | null;
  containsRequiredScope: boolean | null;
  expiry: "future" | "expired" | "absent";
};

function inspectUnverifiedJwt(token: string, resource: string): JwtIndicators {
  const empty: JwtIndicators = {
    jwtSignal: "not_jwt",
    audienceMatchesResource: null,
    containsRequiredScope: null,
    expiry: "absent",
  };
  // Never decode arbitrarily sized or non-JWT bearer strings.
  if (token.length > 8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return empty;
  try {
    const encodedPayload = token.split(".")[1];
    const raw = Buffer.from(encodedPayload, "base64url").toString("utf8");
    if (raw.length > 8192) return { ...empty, jwtSignal: "jwt_unreadable" };
    const claims: unknown = JSON.parse(raw);
    if (!claims || typeof claims !== "object" || Array.isArray(claims))
      return { ...empty, jwtSignal: "jwt_unreadable" };
    const data = claims as Record<string, unknown>;
    const aud = data.aud;
    const scopes = data.scope ?? data.scp;
    const scopeList = typeof scopes === "string" ? scopes.split(/\s+/)
      : Array.isArray(scopes) && scopes.every((scope) => typeof scope === "string") ? scopes : null;
    const expiry = typeof data.exp === "number" && Number.isFinite(data.exp)
      ? (data.exp <= Math.floor(Date.now() / 1000) ? "expired" : "future")
      : "absent";
    return {
      jwtSignal: "jwt_structured",
      audienceMatchesResource: typeof aud === "string" ? aud === resource
        : Array.isArray(aud) && aud.every((item) => typeof item === "string") ? aud.includes(resource) : null,
      containsRequiredScope: scopeList === null ? null : scopeList.includes("mcp:tools"),
      expiry,
    };
  } catch {
    return { ...empty, jwtSignal: "jwt_unreadable" };
  }
}

export function describeMcpAuthFailure(request: Request, response: Response, resource: string) {
  const header = request.headers.get("authorization");
  const bearer = header?.match(/^Bearer\s+([^\s]+)$/i) ?? null;
  const headerKind: AuthHeaderKind = !header ? "missing"
    : bearer ? "bearer"
    : /^Bearer\b/i.test(header) ? "bearer_malformed" : "other_scheme";

  // Only known OAuth codes, never server/user-controlled error descriptions.
  const challenge = response.headers.get("www-authenticate") || "";
  const candidate = /\berror\s*=\s*"?([A-Za-z_]+)"?/i.exec(challenge)?.[1]?.toLowerCase();
  const allowed = ["invalid_token", "invalid_request", "insufficient_scope"];
  const oauthError = candidate && allowed.includes(candidate) ? candidate : "unspecified";

  return {
    status: response.status,
    authHeader: headerKind,
    oauthError,
    client: /^Claude-User$/i.test(request.headers.get("user-agent") || "") ? "claude"
      : "other_or_unknown",
    ...((bearer && inspectUnverifiedJwt(bearer[1], resource)) || {
      jwtSignal: "not_jwt" as const,
      audienceMatchesResource: null,
      containsRequiredScope: null,
      expiry: "absent" as const,
    }),
  };
}
