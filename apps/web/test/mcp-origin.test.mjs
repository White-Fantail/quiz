import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedMcpOrigin } from "../src/lib/mcp-origin.ts";

const site = "https://quizdip.vercel.app";

test("MCP allows authenticated external AI connector origins, and originless clients", () => {
  for (const origin of [null, site, "https://claude.ai", "https://chatgpt.com", "https://chat.openai.com"]) {
    assert.equal(isAllowedMcpOrigin(origin, site), true, String(origin));
  }
});

test("MCP rejects untrusted and malformed Origin values even with OAuth bearer authentication", () => {
  for (const origin of [
    "null",
    "https://evil.example",
    "https://claude.ai.evil.example",
    "http://claude.ai",
    "https://claude.ai/",
    "https://quizdip.vercel.app.attacker.test",
    "file://",
    "",
  ]) {
    assert.equal(isAllowedMcpOrigin(origin, site), false, origin);
  }
});

test("MCP always accepts the configured QuizDip canonical origin", () => {
  assert.equal(isAllowedMcpOrigin("https://quizdip.example", "https://quizdip.example/"), true);
  assert.equal(isAllowedMcpOrigin("https://quizdip.vercel.app", "https://quizdip.example"), false);
});
