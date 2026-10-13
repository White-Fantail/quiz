import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTrustedMcpAdmin } from "../src/modules/platform/auto-approval.ts";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("only trusted OAuth MCP admin actors receive automatic approval", () => {
  assert.equal(isTrustedMcpAdmin({role:"ADMIN",trustedMcpRequest:true}), true);
  assert.equal(isTrustedMcpAdmin({role:"ADMIN"}), false);
  assert.equal(isTrustedMcpAdmin({role:"MEMBER",trustedMcpRequest:true}), false);
  assert.equal(isTrustedMcpAdmin({role:"ADMIN",trustedMcpRequest:true,childScope:{profileId:"kid",deviceId:"ipad"}}), false);
  assert.equal(isTrustedMcpAdmin(null), false);
});

test("MCP provenance is created after verified identity, never from operation arguments", () => {
  const mcp = read("app/api/mcp/route.ts");
  assert.match(mcp, /actorByIdentity\(claims\.sub\)/);
  assert.match(mcp, /trustedMcpRequest: true/);
  assert.match(mcp, /execute\(name, args, actor\)/);
  assert.doesNotMatch(read("src/modules/platform/contracts.ts"), /trustedMcpRequest/);
});

test("upload, import, transform and metadata updates auto approve only trusted MCP admin", () => {
  const media = read("src/modules/platform/media.ts");
  assert.match(media, /const autoApprove = isTrustedMcpAdmin\(actor\) && item\.moderationStatus !== "RESTRICTED"/);
  assert.match(media, /status: "READY", uploadKey: null, uploadExpiresAt: null,[\s\S]*?moderationStatus: "APPROVED"/);
  assert.match(media, /moderationStatus: isTrustedMcpAdmin\(user\) \? "APPROVED" : "PENDING"/);
  assert.match(media, /old\.moderationStatus === "RESTRICTED" \? "RESTRICTED"/);
  assert.match(media, /action: "media.review"/);
});

test("Kids auto approval requires a Kids request, published quiz and approved media", () => {
  const quiz = read("src/modules/platform/quiz.ts");
  assert.match(quiz, /old\.publication === "PUBLISHED" && kidsRequested && isTrustedMcpAdmin\(user\)/);
  assert.match(quiz, /old\.kidsReviewStatus !== "NOT_REQUESTED" && isTrustedMcpAdmin\(user\)/);
  assert.match(quiz, /p\.requested && quiz\.publication === "PUBLISHED" && isTrustedMcpAdmin\(user\)/);
  assert.match(quiz, /await validateMediaReferences\(user\.id, currentRevision\.promptMediaIds[\s\S]*?, true\)/);
  assert.match(quiz, /action:"quiz\.review"/);
  assert.match(read("src/modules/platform/translations.ts"), /isTrustedMcpAdmin\(user\)/);
});
