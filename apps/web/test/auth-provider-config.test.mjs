import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getAvailableProviders } from "../src/lib/auth-providers.ts";

test("Google availability requires both server-side credentials", () => {
  assert.equal(getAvailableProviders({}).google, false);
  assert.equal(getAvailableProviders({ GOOGLE_CLIENT_ID: "google-id" }).google, false);
  assert.equal(getAvailableProviders({ GOOGLE_CLIENT_ID: "google-id", GOOGLE_CLIENT_SECRET: "google-secret" }).google, true);
  assert.equal(getAvailableProviders({ GOOGLE_CLIENT_ID: " ", GOOGLE_CLIENT_SECRET: "google-secret" }).google, false);
});

test("Apple stays disabled until its configuration is complete", () => {
  const base = { APPLE_CLIENT_ID: "services-id" };
  assert.equal(getAvailableProviders(base).apple, false);
  assert.equal(getAvailableProviders({ ...base, APPLE_TEAM_ID: "team", APPLE_KEY_ID: "key" }).apple, false);
  assert.equal(getAvailableProviders({ ...base, APPLE_TEAM_ID: "team", APPLE_KEY_ID: "key", APPLE_PRIVATE_KEY: "private-key" }).apple, true);
  assert.equal(getAvailableProviders({ ...base, APPLE_CLIENT_SECRET: "not-a-jwt" }).apple, false);
  const jwt = (exp) => "header." + Buffer.from(JSON.stringify({ exp })).toString("base64url") + ".signature";
  assert.equal(getAvailableProviders({ ...base, APPLE_CLIENT_SECRET: jwt(1) }).apple, false);
  assert.equal(getAvailableProviders({ ...base, APPLE_CLIENT_SECRET: jwt(Math.floor(Date.now() / 1000) + 3600) }).apple, true);
});

test("account errors do not masquerade as logout, both sign-in providers have explicit disabled states", () => {
  const account = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");
  const signin = readFileSync(new URL("../app/sign-in/sign-in-actions.tsx", import.meta.url), "utf8");
  const accountActions = readFileSync(new URL("../app/account/account-actions.tsx", import.meta.url), "utf8");
  assert.match(account, /unavailable/);
  assert.match(account, /role="alert"/);
  assert.match(account, /<SignInActions /);
  assert.match(signin, /disabled=\{!google \|\| busy !== null\}/);
  assert.match(signin, /disabled=\{!apple \|\| busy !== null\}/);
  assert.match(accountActions, /provider === "apple" \? "준비 중"/);
});
