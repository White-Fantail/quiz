import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const quizService = readFileSync(new URL("../src/modules/platform/quiz.ts", import.meta.url), "utf8");

test("new quiz publications have a rolling 24-hour limit of 100", () => {
  const publish = quizService.slice(quizService.indexOf("export async function quizPublish"));
  assert.match(publish, /action: "quiz\.publish", createdAt: \{ gte: new Date\(Date\.now\(\) - 86400000\) \}/);
  assert.match(publish, /if \(recent >= 100\) fail\(429, "rate_limit", "Daily publication limit reached"\)/);
});

test("ADMIN bypasses only the publication quota; other users still have 100/day", () => {
  const publish = quizService.slice(quizService.indexOf("export async function quizPublish"), quizService.indexOf("/** Explicitly classify a legacy original"));
  assert.match(publish, /if \(old\.publication !== "PUBLISHED" && user\.role !== "ADMIN"\)/);
  assert.match(publish, /if \(recent >= 100\) fail\(429, "rate_limit", "Daily publication limit reached"\)/);
  assert.match(publish, /if \(p\.confirm !== true\) fail\(400, "confirmation_required"/);
  assert.match(publish, /if \(old\.safetyStatus === "RESTRICTED"\) fail\(403, "restricted_quiz"/);
  assert.match(publish, /await validateMediaReferences\(user\.id, currentRevision\.promptMediaIds/);
  assert.match(publish, /await tx\.auditLog\.create\(\{ data: \{ actorId: user\.id, action: "quiz\.publish"/);
});

test("quiz creation has no per-user daily count or rate-limit guard", () => {
  const create = quizService.slice(quizService.indexOf("export async function quizCreate"), quizService.indexOf("export async function quizUpdate"));
  assert.doesNotMatch(create, /db\(\)\.quiz\.count/);
  assert.doesNotMatch(create, /rate_limit|Daily creation limit reached/);
  assert.match(create, /await validateMediaReferences\(user\.id, p\.promptMediaIds \?\? \[\], p\.clues\)/);
});
