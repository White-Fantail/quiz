import test from "node:test";
import assert from "node:assert/strict";
import { answerSchema } from "../src/modules/platform/contracts.ts";
import { publicAnswerFormat, disclosedAnswerChoices } from "../src/modules/platform/answer-options.ts";
import { isCorrectAnswer, scoreForAnswer } from "../../../packages/domain/src/game.ts";

const mc = {
  canonical: "Tyrannosaurus", aliases: ["T-Rex"],
  responseMode: "multiple-choice",
  options: ["Triceratops", "Tyrannosaurus", "Stegosaurus", "Brachiosaurus"]
};

test("legacy answers stay free-text without data migration", () => {
  const legacy = answerSchema.parse({ canonical: "Kiwi", aliases: ["kiwi bird"] });
  assert.equal(legacy.responseMode, undefined);
  assert.deepEqual(publicAnswerFormat(legacy, "session-1"), {responseMode:"text"});
  assert.ok(isCorrectAnswer(legacy, "  KIWI BIRD "));
  assert.equal(scoreForAnswer(4, 1, legacy.responseMode), 100);
});

test("explicit multiple-choice options are validated as unique and include one correct answer", () => {
  assert.equal(answerSchema.parse(mc).options.length, 4);
  for (const options of [
    ["Triceratops", "Stegosaurus"],
    ["Tyrannosaurus", "TYRANNOSAURUS"],
    ["Tyrannosaurus", "T-Rex"],
    ["Tyrannosaurus"]
  ]) {
    const result=answerSchema.safeParse({...mc,options});
    assert.equal(result.success, false, JSON.stringify(options));
  }
  assert.equal(answerSchema.safeParse({canonical:"Kiwi",aliases:[],options:["Kiwi","Owl"]}).success,false);
});

test("choices are stable for a resumed session, shuffled between sessions, and have no answer key", () => {
  const first=publicAnswerFormat(mc, "session-1");
  assert.equal(first.responseMode, "multiple-choice");
  assert.deepEqual(first.options, disclosedAnswerChoices(mc, "session-1"));
  assert.deepEqual(first, publicAnswerFormat(mc, "session-1"));
  assert.deepEqual(new Set(first.options), new Set(mc.options));
  assert.deepEqual(Object.keys(first).sort(), ["options","responseMode"]);
  const orders=new Set(Array.from({length:25},(_,i)=>publicAnswerFormat(mc,"session-"+i).options?.join("|")));
  assert.ok(orders.size>1);
});

test("score cap applies only to authored multiple-choice", () => {
  assert.equal(scoreForAnswer(5,1,"multiple-choice"),75);
  assert.equal(scoreForAnswer(5,1,"text"),100);
  assert.equal(scoreForAnswer(5,1),100);
  assert.ok(scoreForAnswer(5,4,"multiple-choice")<75);
});
