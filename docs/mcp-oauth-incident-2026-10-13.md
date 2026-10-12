# MCP OAuth incident: token 200 followed by MCP 401 (13 Oct 2026)

## Evidence

- Production `POST /api/auth/oauth2/token` returned HTTP 200.
- Claude subsequently called `POST /api/mcp` with `Authorization: Bearer` and received HTTP 401.
- `jwtSignal: "not_jwt"` came from a *heuristic* log helper, not the cryptographic verifier. It suggests the presented bearer was opaque, not that the token issued by QuizDip was the same token.
- Better Auth OAuth Provider 1.7.7 issues resource-bound JWT access tokens; if there is no audience, it issues opaque access tokens. The authorization code grant inherits the resource specified on the original authorization request, even when omitted from the token exchange.

## Scoped compatibility fix

If (and only if) a GET `/api/auth/oauth2/authorize` request explicitly requests the `mcp:tools` scope **and** contains no `resource` parameter, the server adds the single configured canonical QuizDip MCP resource to that authorization request. This ensures the resulting authorization code can be bound to the expected audience.

- Explicit `resource` parameters (including invalid ones) remain unchanged.
- OAuth scopes, state, PKCE, client identifiers, redirect URI, consent and token endpoint validation are unchanged.
- Google/Apple sign-in and ordinary OAuth requests are unchanged.
- Previously issued opaque tokens cannot become JWTs by this change: the MCP client must reconnect/re-authorize for a fresh code and token.

## Automatically expiring production trace

Temporary trace logs are active only until **2026-10-16 00:00 UTC**. To stop them immediately, add `MCP_OAUTH_TRACE_DISABLED=true` in the production environment and redeploy (environment changes normally require a redeployment).

Trace records:

- `[mcp-oauth-trace]` during `/oauth2/authorize`: whether the client sent `resource`, whether it matches the configured MCP resource, whether the scope contains `mcp:tools`, and whether the compatibility default was applied.
- `[mcp-oauth-trace]` during `/oauth2/token`: grant type, resource indicators, status, whether JWT/opaque was issued, JWT audience/issuer/scope/expiry indicators, refresh-token presence (Boolean), and `tokenFingerprint`.
- `[mcp-oauth-trace] MCP token rejected` during `POST /api/mcp` (401/403): the same fingerprint, token-shape indicators, and whether a DPoP proof was presented.

The fingerprint is a truncated HMAC-SHA256 computed using the server's `BETTER_AUTH_SECRET`. It is *not* the access token, is not reversible under normal OAuth token entropy, and can be correlated between the issuance and use events. It is never exposed to the client.

**Never print or paste the actual access token, refresh token, authorization code, cookies, client secret, PKCE verifier, raw OAuth response or signed JWT into incident logs or chat.** This tracing is sufficient without leaking credentials.

## Runbook

1. Deploy the change and verify Vercel reports the updated commit.
2. Remove the *existing* QuizDip MCP connection from Claude and reconnect, completing the browser approval flow. Old bearer tokens may continue to return 401 until replaced.
3. In Vercel production runtime logs, filter `[mcp-oauth-trace]`. Follow authorize → token → MCP calls.
4. If `authorize.resourceProvided=false` and `resourceDefaulted=true`, the compatibility fix ran. Expect `token.tokenFormat=jwt`, `jwtAudienceMatches=true`, `jwtIssuerMatches=true`, `jwtHasMcpScope=true`.
5. If `token.tokenFormat=opaque_or_other`, then inspect whether `resourceMatchesMcp=false` at authorization and `resourceDefaulted=false` (explicit wrong resource, wrong scope, or other flow). If JWT was issued but MCP still rejected, compare fingerprints:
   - Same fingerprint means a validation-policy problem (JWT signing, issuer, audience, scope, expiry, DPoP).
   - Different fingerprints mean the client presented a different or cached credential.
6. Check that the final `POST /api/mcp` returns HTTP 200 and tool discovery works. Check ChatGPT separately; Claude's token flow does not prove ChatGPT connectivity.
7. At the hard expiration, no further trace events are emitted, even from a still-running deployment. Retention of logs already stored follows the Vercel team's retention policy; delete stored logs separately if warranted.

## Scope and limits

This fix does **not** accept opaque tokens at the MCP resource server, weaken JWT verification, disable PKCE/consent, or log secrets. It cannot prove the root cause until the trace from a fresh connection is observed. The Vercel integration used for initial incident investigation returned 403 for runtime log access, so log inspection may require a user with access to the Vercel team.
