import test from "node:test";
import assert from "node:assert/strict";
import { describeMcpAuthFailure } from "../src/lib/mcp-auth-diagnostics.ts";

const resource = "https://quizdip.vercel.app/api/mcp";
const request = (headers = {}) => new Request(resource, {
  method: "POST",
  headers: { "user-agent": "Claude-User", ...headers },
});
const denied = (challenge = 'Bearer error="invalid_token"') =>
  new Response(null, { status: 401, headers: { "www-authenticate": challenge } });

test("missing, bearer, and malformed Authorization signals are explicitly distinguished", () => {
  assert.equal(describeMcpAuthFailure(request(), denied(), resource).authHeader, "missing");
  assert.equal(describeMcpAuthFailure(request({ authorization: "Basic xyz" }), denied(), resource).authHeader, "other_scheme");
  assert.equal(describeMcpAuthFailure(request({ authorization: "Bearer " }), denied(), resource).authHeader, "bearer_malformed");
  const opaque = describeMcpAuthFailure(request({ authorization: "Bearer secret-token-123" }), denied(), resource);
  assert.equal(opaque.authHeader, "bearer");
  assert.equal(opaque.jwtSignal, "not_jwt");
  assert.equal(opaque.client, "claude");
  assert.equal(opaque.oauthError, "invalid_token");
  assert.equal(opaque.status, 401);
  assert.equal(JSON.stringify(opaque).includes("secret-token-123"), false);
});

test("untrusted JWT hints show only boolean indicators, not bearer data or claim values", () => {
  const payload = Buffer.from(JSON.stringify({
    sub: "private-user-id",
    aud: resource,
    scope: "openid mcp:tools offline_access",
    exp: Math.floor(Date.now() / 1000) + 600,
    token_secret: "must-not-log",
  })).toString("base64url");
  const bearer = "tokenheader." + payload + ".tokensignature";
  const result = describeMcpAuthFailure(
    request({ authorization: "Bearer " + bearer }), denied(), resource,
  );
  assert.equal(result.jwtSignal, "jwt_structured");
  assert.equal(result.audienceMatchesResource, true);
  assert.equal(result.containsRequiredScope, true);
  assert.equal(result.expiry, "future");
  const serialized = JSON.stringify(result);
  for (const secret of [bearer, "private-user-id", "must-not-log", resource, "openid"])
    assert.equal(serialized.includes(secret), false, secret);
});

test("wrong audience, missing scope and expiration are indicated without claiming token verification", () => {
  const payload = Buffer.from(JSON.stringify({
    aud: "https://other.example/api/mcp",
    scope: "profile",
    exp: 1234,
  })).toString("base64url");
  const result = describeMcpAuthFailure(
    request({ authorization: "Bearer hdr." + payload + ".sig" }), denied(), resource,
  );
  assert.equal(result.audienceMatchesResource, false);
  assert.equal(result.containsRequiredScope, false);
  assert.equal(result.expiry, "expired");
});

test("OAuth descriptions and untrusted header values cannot enter diagnostics", () => {
  const marker = "secret-and-private-identifier";
  const result = describeMcpAuthFailure(
    request({ authorization: "Bearer " + marker, "user-agent": "Claude-User " + marker }),
    denied('Bearer error="something_unexpected", error_description="' + marker + '"'),
    resource,
  );
  assert.equal(result.oauthError, "unspecified");
  assert.equal(result.client, "other_or_unknown");
  assert.equal(JSON.stringify(result).includes(marker), false);
});

test("large or invalid JWT-looking credentials are never decoded or logged", () => {
  const bad = describeMcpAuthFailure(
    request({ authorization: "Bearer a." + "A".repeat(10000) + ".b" }), denied(), resource,
  );
  assert.equal(bad.jwtSignal, "not_jwt");
  assert.equal(bad.audienceMatchesResource, null);

  const broken = describeMcpAuthFailure(request({ authorization: "Bearer a.e30.b" }), denied(), resource);
  assert.equal(broken.jwtSignal, "jwt_structured");
  assert.equal(broken.expiry, "absent");
});

test("helper does not consume or modify the response", async () => {
  const res = Response.json({ error: "unauthorized" }, { status: 401 });
  const info = describeMcpAuthFailure(request(), res, resource);
  assert.equal(info.status, 401);
  assert.deepEqual(await res.json(), { error: "unauthorized" });
});
