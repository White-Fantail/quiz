import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const auth = source("src/lib/auth.ts");
const identity = source("src/modules/platform/auth.ts");
const mcp = source("app/api/mcp/route.ts");
const rest = source("app/api/v1/[...segments]/route.ts");
const account = source("app/account/account-actions.tsx");

test("explicit Google and Apple identity linking, no email-based automatic merge", () => {
  assert.match(auth, /disableImplicitLinking:\s*true/);
  assert.match(auth, /allowDifferentEmails:\s*true/);
  assert.match(auth, /trustedProviders:\s*\["google", "apple"\]/);
  assert.match(account, /authClient\.linkSocial\(/);
  assert.match(account, /authClient\.listAccounts\(/);
});

test("browser and MCP share one verified Better Auth identity to the domain actor", () => {
  assert.match(identity, /auth\.api\.getSession\(/);
  assert.match(identity, /return actorByIdentity\(session\.user\.id\)/);
  assert.match(identity, /where:\s*\{ id \}/);
  assert.match(mcp, /requireMcpAuth\(auth/);
  assert.match(mcp, /actorByIdentity\(claims\.sub\)/);
  assert.match(mcp, /requiredScopes:\s*\["mcp:tools"\]/);
  assert.match(mcp, /challengeScopes:\s*\["mcp:tools",\s*"offline_access"\]/);
  assert.match(auth, /scopes:\s*\["openid",\s*"profile",\s*"email",\s*"offline_access",\s*"mcp:tools"\]/);
  assert.match(auth, /accessTokenExpiresIn:\s*3600/);
  assert.match(mcp, /legacy:\s*"stateless"/);
  assert.match(mcp, /Object\.keys\(operations\)/);
  assert.match(rest, /requireSameOrigin\(request\)/);
});

test("MCP is audience-bound and client IDs are verified via safe metadata discovery", () => {
  assert.match(auth, /mcpResource\s*=\s*siteOrigin\s*\+\s*"\/api\/mcp"/);
  assert.match(auth, /resource:\s*mcpResource/);
  assert.match(auth, /metadataProfile:\s*"mcp-2026-07-28"/);
  assert.match(auth, /fetchClientMetadataResource/);
  assert.match(auth, /MCP_ENABLE_DCR\s*===\s*"true"/);
  assert.match(auth, /encryptOAuthTokens:\s*true/);
});

test("web REST rejects bearer passthrough and unsafe cross-origin mutations", () => {
  assert.match(identity, /if \(request\.headers\.has\("authorization"\)\)/);
  assert.match(identity, /"unsupported_credentials"/);
  assert.match(identity, /"invalid_origin"/);
  assert.match(identity, /"origin"/);
  assert.match(identity, /requireSameOrigin/);
});
