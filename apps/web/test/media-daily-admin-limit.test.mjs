import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isExemptFromDailyMediaLimit } from "../src/modules/platform/media-upload-policy.ts";

const media = readFileSync(new URL("../src/modules/platform/media.ts", import.meta.url), "utf8");

test("only server-resolved ADMIN roles bypass the daily media count", () => {
  assert.equal(isExemptFromDailyMediaLimit({ role: "ADMIN" }), true);
  for (const role of ["MEMBER", "USER", "CREATOR", "MODERATOR", "", "admin"]) {
    assert.equal(isExemptFromDailyMediaLimit({ role }), false, role);
  }
});

test("upload, import and transform enforce the same server-side role policy", () => {
  assert.match(media, /async function dailyLimit\(user: Actor\)/);
  assert.match(media, /if \(isExemptFromDailyMediaLimit\(user\)\) return;/);
  assert.match(media, /where: \{ ownerId: user\.id, createdAt:/);
  assert.equal(media.match(/await dailyLimit\(user\)/g)?.length, 3);
  assert.doesNotMatch(media, /await dailyLimit\(user\.id\)/);
  assert.match(media, /checkSize\(p\.kind, p\.sizeBytes\)/);
  assert.match(media, /checkSize\(p\.kind, fetched\.bytes\.length\)/);
  assert.match(media, /await sniff\(bytes, item\.kind, item\.mimeType\)/);
  assert.match(media, /const origin = await asset\(p\.id, actor\)/);
});
