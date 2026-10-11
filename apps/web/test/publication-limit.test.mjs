import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const quizService = readFileSync(new URL("../src/modules/platform/quiz.ts", import.meta.url), "utf8");

test("new quiz publications have a rolling 24-hour limit of 100", () => {
  const publish = quizService.slice(quizService.indexOf("export async function quizPublish"));
  assert.match(publish, /action: "quiz\.publish", createdAt: \{ gte: new Date\(Date\.now\(\) - 86400000\) \}/);
  assert.match(publish, /if \(recent >= 100\) fail\(429, "rate_limit", "Daily publication limit reached"\)/);
});

test("creation quota remains at 100 per rolling 24 hours", () => {
  const create = quizService.slice(quizService.indexOf("export async function quizCreate"), quizService.indexOf("export async function quizUpdate"));
  assert.match(create, /if \(count >= 100\) fail\(429, "rate_limit", "Daily creation limit reached"\)/);
});
