import test from "node:test";
import assert from "node:assert/strict";
import { listDemoQuizSummaries } from "../src/modules/quiz/service.ts";

test("demo quiz service exposes metadata but never answers or clue bodies", () => {
  const summaries = listDemoQuizSummaries();
  assert.equal(summaries.length, 1);
  assert.deepEqual(
    Object.keys(summaries[0]).sort(),
    ["clueCount", "id", "mode", "title"],
  );
  assert.equal("answer" in summaries[0], false);
  assert.equal("clues" in summaries[0], false);
  assert.equal(summaries[0].clueCount, 4);
});
