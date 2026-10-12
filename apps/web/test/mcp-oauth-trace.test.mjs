import test from "node:test";
import assert from "node:assert/strict";
import {
  MCP_OAUTH_TRACE_END,
  mcpOAuthTraceEnabled,
  summarizeOAuthRequest,
  summarizeOAuthResponse,
  summarizeMcpBearer,
} from "../src/lib/mcp-oauth-trace.ts";

const resource = "https://quizdip.vercel.app/api/mcp";
const issuer = "https://quizdip.vercel.app";

function withSecret(fn) {
  const before = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "a-long-test-secret-never-used-in-production";
  try { return fn(); } finally {
    if (before === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = before;
  }
}

test("diagnostic code has a hard expiry and a runtime kill switch", () => {
  assert.equal(MCP_OAUTH_TRACE_END, "2026-10-16T00:00:00.000Z");
  assert.equal(mcpOAuthTraceEnabled(Date.parse("2026-10-15T23:59:59Z")), true);
  assert.equal(mcpOAuthTraceEnabled(Date.parse(MCP_OAUTH_TRACE_END)), false);
  const original = process.env.MCP_OAUTH_TRACE_DISABLED;
  process.env.MCP_OAUTH_TRACE_DISABLED = "true";
  try {
    assert.equal(mcpOAuthTraceEnabled(Date.parse("2026-10-15T23:00:00Z")), false);
  } finally {
    if (original === undefined) delete process.env.MCP_OAUTH_TRACE_DISABLED;
    else process.env.MCP_OAUTH_TRACE_DISABLED = original;
  }
});

test("authorize traces report only resource/scope flags, never authorization query secrets", async () => {
  const url = new URL(issuer + "/api/auth/oauth2/authorize");
  url.searchParams.set("resource", resource);
  url.searchParams.set("client_id", "sensitive-client-xyz");
  url.searchParams.set("state", "private-state-abc");
  url.searchParams.set("code_challenge", "secret-pkce-challenge");
  url.searchParams.set("scope", "openid mcp:tools offline_access");
  const trace = await summarizeOAuthRequest(new Request(url), "authorize", resource);
  assert.equal(trace.resourceMatchesMcp, true);
  assert.equal(trace.requestedMcpScope, true);
  assert.equal(trace.phase, "authorize");
  const logged = JSON.stringify(trace);
  for (const forbidden of ["sensitive-client-xyz", "private-state-abc", "secret-pkce-challenge", resource])
    assert.equal(logged.includes(forbidden), false, forbidden);
});

test("token tracing leaves the original POST body usable and never logs code, PKCE, refresh, secret", async () => {
  const url = issuer + "/api/auth/oauth2/token";
  const form = new URLSearchParams({
    grant_type: "authorization_code", code: "private-code-xyz", code_verifier: "private-pkce-verifier",
    client_secret: "private-client-secret", scope: "mcp:tools", resource,
  });
  const request = new Request(url, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const trace = await summarizeOAuthRequest(request, "token", resource);
  assert.equal(trace.grantType, "authorization_code");
  assert.equal(trace.resourceMatchesMcp, true);
  assert.equal(trace.requestedMcpScope, true);
  assert.equal((await request.text()).includes("private-code-xyz"), true);
  for (const secret of ["private-code-xyz", "private-pkce-verifier", "private-client-secret", resource])
    assert.equal(JSON.stringify(trace).includes(secret), false, secret);
});

test("issued access token and MCP rejection produce matching opaque fingerprints", async () => {
  await withSecret(async () => {});
  const oldSecret = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "test-secret-32-characters-minimum-value";
  try {
    const token = "very-private-opaque-access-token-1234567890";
    const body = {
      token_type: "Bearer", access_token: token, refresh_token: "secret-refresh-token",
      scope: "openid profile mcp:tools offline_access",
    };
    const response = Response.json(body);
    const issued = await summarizeOAuthResponse(response, "token", resource, issuer);
    const request = new Request(resource, { method: "POST", headers: { authorization: "Bearer " + token } });
    const received = summarizeMcpBearer(request, resource, issuer);
    assert.equal(issued.tokenFormat, "opaque_or_other");
    assert.equal(issued.refreshTokenIssued, true);
    assert.equal(issued.grantedMcpScope, true);
    assert.equal(issued.tokenFingerprint, received.tokenFingerprint);
    assert.equal(typeof issued.tokenFingerprint, "string");
    assert.deepEqual(await response.json(), body);
    for (const secret of [token, body.refresh_token, body.scope, resource]) {
      assert.equal(JSON.stringify(issued).includes(secret), false, secret);
      assert.equal(JSON.stringify(received).includes(secret), false, secret);
    }
  } finally {
    if (oldSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = oldSecret;
  }
});

test("JWT trace reports only verification hints; never trusts or logs claims", async () => {
  const oldSecret = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "test-secret-32-characters-minimum-value";
  try {
    const head = Buffer.from(JSON.stringify({ alg: "ES256", typ: "at+jwt", kid: "private-key-id" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: issuer, aud: resource, scope: "mcp:tools", exp: Math.floor(Date.now() / 1000) + 300,
      sub: "private-user-id", client_id: "private-client-id",
    })).toString("base64url");
    const token = head + "." + payload + ".fakesignature";
    const summary = summarizeMcpBearer(new Request(resource, { headers: { authorization: "Bearer " + token } }), resource, issuer);
    assert.equal(summary.tokenFormat, "jwt");
    assert.equal(summary.jwtAudienceMatches, true);
    assert.equal(summary.jwtIssuerMatches, true);
    assert.equal(summary.jwtHasMcpScope, true);
    assert.equal(summary.jwtExpired, false);
    assert.equal(summary.jwtTypeAccessToken, true);
    for (const secret of ["private-user-id", "private-client-id", "private-key-id", token, resource])
      assert.equal(JSON.stringify(summary).includes(secret), false, secret);
  } finally {
    if (oldSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = oldSecret;
  }
});

test("malformed or oversized token grant payload never becomes a log entry", async () => {
  const request = new Request(issuer + "/api/auth/oauth2/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=refresh_token&refresh_token=" + "A".repeat(20_000),
  });
  const trace = await summarizeOAuthRequest(request, "token", resource);
  assert.equal(trace.resourceProvided, false);
  assert.equal(trace.grantType, "absent");
  const issued = await summarizeOAuthResponse(Response.json({ error: "invalid_grant", error_description: "private-description" }, { status: 400 }), "token", resource, issuer);
  assert.equal(issued.oauthError, "invalid_grant");
  assert.equal(JSON.stringify(issued).includes("private-description"), false);
});
