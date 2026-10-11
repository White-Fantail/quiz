import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const quizService = readFileSync(new URL("../src/modules/platform/quiz.ts", import.meta.url), "utf8");

test("new quiz publications have a rolling 24-hour limit of 100", () => {
  const publish = quizService.slice(quizService.indexOf("export async function quizPublish"));
  assert.match(publish, /action: "quiz\.publish", createdAt: \{ gte: new Date\(Date\.now\(\) - 86400000\) \}/);
  assert.match(publish, /if \(recent >= 100\) fail\(429, "rate_limit", "Daily publication limit reached"\)/);
});

test("quiz creation has no per-user daily count or rate-limit guard", () => {
  const create = quizService.slice(quizService.indexOf("export async function quizCreate"), quizService.indexOf("export async function quizUpdate"));
  assert.doesNotMatch(create, /db\(\)\.quiz\.count/);
  assert.doesNotMatch(create, /rate_limit|Daily creation limit reached/);
  assert.match(create, /await validateMediaReferences\(user\.id, p\.promptMediaIds \?\? \[\], p\.clues\)/);
});
