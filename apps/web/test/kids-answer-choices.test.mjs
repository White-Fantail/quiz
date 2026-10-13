import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildKidAnswerChoices } from "../src/modules/kids/answer-choices.ts";

const candidate = (quizId, canonical, aliases = []) => ({ quizId, answer: { canonical, aliases } });
const candidates = [
  candidate("owl", "Owl"), candidate("bee", "Bee"),
  candidate("butterfly", "Butterfly"), candidate("swan", "Swan"),
  candidate("eagle", "Eagle"), candidate("giraffe", "Giraffe")
];
const choices = (overrides = {}) => buildKidAnswerChoices({
  sessionId: "session-one", runId: "run-one", roundIndex: 0,
  answer: { canonical: "Parrot", aliases: [] }, candidates, minDecoys: 2, ...overrides
});

test("Kids questions show four unique options, with exactly one correct answer", () => {
  const options = choices();
  assert.equal(options.length, 4);
  assert.equal(new Set(options.map(x => x.toLowerCase())).size, 4);
  assert.equal(options.filter(x => x === "Parrot").length, 1);
});

test("four successive rounds use each answer slot once within a run", () => {
  const positions = Array.from({ length: 4 }, (_, roundIndex) =>
    choices({ sessionId: "session-" + roundIndex, roundIndex }).indexOf("Parrot"));
  assert.deepEqual([...positions].sort(), [0, 1, 2, 3]);
  assert.deepEqual(choices({ roundIndex: 2 }), choices({ roundIndex: 2 }));
  assert.deepEqual(choices({ roundIndex: 2, sessionId: "reloaded-same-session" }),
    choices({ roundIndex: 2, sessionId: "reloaded-same-session" }));
});

test("different runs vary the position but reloading a session never changes it", () => {
  const positions = new Set();
  for (let i = 0; i < 40; i++) {
    const input = { runId: "run-" + i, sessionId: "session-" + i, roundIndex: 0 };
    const first = choices(input);
    assert.deepEqual(first, choices(input));
    positions.add(first.indexOf("Parrot"));
  }
  assert.deepEqual([...positions].sort(), [0, 1, 2, 3]);
});

test("standalone sessions have reproducible but varied answer locations", () => {
  const positions = new Set();
  for (let i = 0; i < 40; i++) {
    const input = { runId: null, roundIndex: null, sessionId: "single-" + i };
    assert.deepEqual(choices(input), choices(input));
    positions.add(choices(input).indexOf("Parrot"));
  }
  assert.deepEqual([...positions].sort(), [0, 1, 2, 3]);
});

test("pack neighbors take priority over unrelated animals", () => {
  const options = choices({ preferredQuizIds: new Set(["owl", "bee", "butterfly"]) });
  assert.deepEqual(new Set(options), new Set(["Parrot", "Owl", "Bee", "Butterfly"]));
});

test("aliases and case/whitespace variations cannot create duplicate or ambiguous answers", () => {
  const options = choices({
    answer: { canonical: "Parrot", aliases: ["  Scarlet   Macaw "] },
    candidates: [
      candidate("macaw", "SCARLET MACAW"),
      candidate("bird", "Bird", ["parrot"]),
      candidate("duplicate", "owl"),
      candidate("owl", "Owl"),
      candidate("duck", "Duck", ["OWL"]),
      candidate("bee", "Bee"),
      candidate("swan", "Swan")
    ]
  });
  assert.equal(options.length, 4);
  assert.deepEqual(new Set(options), new Set(["Parrot", "Owl", "Bee", "Swan"]));
});

test("fall back to typing if insufficient safe decoys exist", () => {
  assert.deepEqual(choices({ candidates: [candidate("duplicate", "parrot")], minDecoys: 1 }), []);
  const oneDecoy = choices({ candidates: [candidate("owl", "Owl")], minDecoys: 1 });
  assert.equal(oneDecoy.length, 2);
  assert.equal(choices({ candidates: [candidate("owl", "Owl")], minDecoys: 2 }).length, 0);
});

test("native game server uses the choice builder after checking published, Kids-approved content", () => {
  const source = readFileSync(new URL("../src/modules/kids/game.ts", import.meta.url), "utf8");
  assert.match(source, /buildKidAnswerChoices/);
  assert.match(source, /playableQuizWhere\(kid\.profile\.locale as/);
  assert.match(source, /packQuestion\.findMany/);
  assert.match(source, /minDecoys:kid\.profile\.ageBand==="EARLY"\?1:2/);
  assert.match(source, /options:await answerChoices/);
});
