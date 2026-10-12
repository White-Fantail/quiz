import test from "node:test";
import assert from "node:assert/strict";
import { defaultMcpAuthorizationResource } from "../src/lib/mcp-oauth-resource.ts";

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
