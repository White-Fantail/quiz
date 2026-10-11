import test from "node:test";
import assert from "node:assert/strict";
import { isCorrectAnswer, isEligibleForKids, scoreForClues } from "../src/index.ts";

test("answer checks support aliases, whitespace and case", () => {
  const answer = { canonical: "Dolphin", aliases: ["돌고래"] };
  assert.equal(isCorrectAnswer(answer, "  DOLPHIN  "), true);
  assert.equal(isCorrectAnswer(answer, "돌고래"), true);
  assert.equal(isCorrectAnswer(answer, ""), false);
  assert.equal(isCorrectAnswer(answer, "whale"), false);
});

test("only published AND platform-approved content can appear in Kids", () => {
  const pub = { publication: "published", platformSafety: { status: "approved" } };
  assert.equal(isEligibleForKids(pub), true);
  assert.equal(isEligibleForKids({ ...pub, publication: "draft" }), false);
  assert.equal(isEligibleForKids({ ...pub, platformSafety: { status: "pending" } }), false);
  assert.equal(isEligibleForKids({ ...pub, platformSafety: { status: "restricted" } }), false);
});

test("scoring is non-increasing with clue use", () => {
  assert.equal(scoreForClues(4, 1), 100);
  assert.equal(scoreForClues(4, 4), 20);
  assert.ok(scoreForClues(4, 2) > scoreForClues(4, 3));
  assert.equal(scoreForClues(0, 1), 0);
});
