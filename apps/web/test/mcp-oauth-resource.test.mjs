import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { defaultMcpAuthorizationResource, defaultMcpRefreshResource } from "../src/lib/mcp-oauth-resource.ts";

const base = "https://quizdip.vercel.app/api/auth/oauth2/authorize";
const resource = "https://quizdip.vercel.app/api/mcp";
const make = (scope, additional = {}) => {
  const url = new URL(base);
  if (scope !== undefined) url.searchParams.set("scope", scope);
  for (const [key, value] of Object.entries(additional)) url.searchParams.set(key, value);
  return new Request(url, { headers: { cookie: "safe=test" } });
};

test("missing RFC 8707 resource defaults only for explicit mcp:tools authorization", async () => {
  const request = make("openid mcp:tools offline_access", {
    state: "opaque-state-123", code_challenge: "opaque-verifier-456",
    redirect_uri: "https://claude.ai/redirect",
  });
  const normalized = defaultMcpAuthorizationResource(request, resource);
  assert.equal(normalized.applied, true);
  assert.equal(new URL(normalized.request.url).searchParams.get("resource"), resource);
  assert.equal(new URL(request.url).searchParams.has("resource"), false);
  assert.equal(new URL(normalized.request.url).searchParams.get("state"), "opaque-state-123");
  assert.equal(new URL(normalized.request.url).searchParams.get("code_challenge"), "opaque-verifier-456");
  assert.equal(new URL(normalized.request.url).searchParams.get("redirect_uri"), "https://claude.ai/redirect");
  assert.equal(normalized.request.headers.get("cookie"), "safe=test");
});

test("explicit resource stays untouched even if blank, wrong or malicious", () => {
  for (const existing of ["", "https://other.example/private-api", resource]) {
    const request = make("mcp:tools", { resource: existing });
    const normalized = defaultMcpAuthorizationResource(request, resource);
    assert.equal(normalized.applied, false);
    assert.strictEqual(normalized.request, request);
  }
});

test("ordinary OAuth login, unrelated scopes, wrong methods or endpoints never change", () => {
  for (const scope of [undefined, "openid email profile", "mcp:read", "mcp:tools-extra"]) {
    const request = make(scope);
    assert.equal(defaultMcpAuthorizationResource(request, resource).applied, false);
  }
  const post = new Request(base, { method: "POST" });
  assert.equal(defaultMcpAuthorizationResource(post, resource).applied, false);
  const callback = new Request("https://quizdip.vercel.app/api/auth/oauth2/token");
  assert.equal(defaultMcpAuthorizationResource(callback, resource).applied, false);
});

test("MCP OAuth trace and rejection instrumentation are absent while authorization works", () => {
  const authRoute = readFileSync(new URL("../app/api/auth/[...all]/route.ts", import.meta.url), "utf8");
  const mcpRoute = readFileSync(new URL("../app/api/mcp/route.ts", import.meta.url), "utf8");
  assert.match(authRoute, /defaultMcpAuthorizationResource\(request, mcpResource\)/);
  assert.match(mcpRoute, /requireMcpAuth\(auth,/);
  assert.match(mcpRoute, /requiredScopes: \["mcp:tools"\]/);
  for (const source of [authRoute, mcpRoute]) {
    assert.doesNotMatch(source, /mcp-oauth-trace|mcp-auth-diagnostics|MCP OAuth rejection|tokenFingerprint|summarizeOAuthResponse/);
  }
  for (const removed of [
    "../src/lib/mcp-oauth-trace.ts",
    "../src/lib/mcp-auth-diagnostics.ts",
  ]) {
    assert.equal(existsSync(new URL(removed, import.meta.url)), false);
  }
});

const tokenEndpoint = "https://quizdip.vercel.app/api/auth/oauth2/token";
const refreshRequest = (fields, headers = {}) => new Request(tokenEndpoint, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
  body: new URLSearchParams(fields),
});

test("OAuth refresh without resource keeps the protected MCP JWT audience", async () => {
  const original = refreshRequest({
    grant_type: "refresh_token",
    client_id: "https://chatgpt.com/example/client-metadata",
    refresh_token: "sensitive-placeholder",
  });
  const { request, applied } = await defaultMcpRefreshResource(original, resource);
  assert.equal(applied, true);
  assert.equal(new URLSearchParams(await request.text()).get("resource"), resource);
  assert.equal(new URLSearchParams(await original.text()).has("resource"), false);
  assert.equal(request.headers.has("content-length"), false);
});

test("refresh preserves explicit resource including malformed or empty values", async () => {
  for (const value of [resource, "", "https://another.example/api"]) {
    const request = refreshRequest({ grant_type: "refresh_token", refresh_token: "opaque", resource: value });
    const result = await defaultMcpRefreshResource(request, resource);
    assert.equal(result.applied, false);
    assert.strictEqual(result.request, request);
    assert.equal(new URLSearchParams(await result.request.text()).get("resource"), value);
  }
});

test("resource fallback cannot change other OAuth grants, endpoints or content types", async () => {
  const requests = [
    refreshRequest({ grant_type: "authorization_code", code: "placeholder" }),
    refreshRequest({ grant_type: "client_credentials" }),
    new Request(tokenEndpoint, { method: "POST", headers: { "content-type": "application/json" }, body: '{"grant_type":"refresh_token"}' }),
    new Request("https://quizdip.vercel.app/api/auth/oauth2/revoke", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token",
    }),
    new Request(tokenEndpoint, { method: "GET" }),
    refreshRequest({ grant_type: "refresh_token" }, { "content-length": "9000" }),
  ];
  for (const request of requests) {
    const result = await defaultMcpRefreshResource(request, resource);
    assert.equal(result.applied, false);
    assert.strictEqual(result.request, request);
  }
});

test("OAuth resource fallback is wired for authorization and refresh without token logging", () => {
  const source = readFileSync(new URL("../app/api/auth/[...all]/route.ts", import.meta.url), "utf8");
  assert.ok(source.includes("defaultMcpAuthorizationResource(request, mcpResource)"));
  assert.ok(source.includes("defaultMcpRefreshResource(authorization.request, mcpResource)"));
  assert.doesNotMatch(source, /mcp-oauth-trace|tokenFingerprint|summarizeOAuthResponse/);
});
