import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  audienceAgeLabel, difficultyLabel, discoverQuery, modeLabel, publicTopics, ANSWER_TYPES
} from "../src/modules/quiz/discover-metadata.ts";
import { parseOperation } from "../src/modules/platform/contracts.ts";

test("Discover uses answer types instead of treating game modes as categories", () => {
  assert.equal(modeLabel("progressive-clues"), "단계별 단서");
  assert.deepEqual(ANSWER_TYPES.map(item => item.value),
    ["animal", "person", "place", "thing", "event", "concept", "other"]);
  const parsed = new URLSearchParams(discoverQuery({
    answerType:"animal", topic:"동물", kids:true, limit:13, offset:12
  }));
  assert.equal(parsed.get("answerType"), "animal");
  assert.equal(parsed.get("topic"), "동물");
  assert.equal(parsed.get("kids"), "true");
  assert.equal(parsed.get("offset"), "12");
  assert.equal(parsed.get("limit"), "13");
  assert.equal(parsed.has("mode"), false);
});
test("Discover hides explicitly spoiler-marked topics and displays recommendations as recommendations", () => {
  const visible = publicTopics({topics:[
    {name:"동물"}, {name:"정답",isSpoiler:true}, {name:"자연",isSpoiler:false}
  ]});
  assert.deepEqual(visible.map(item => item.name), ["동물","자연"]);
  assert.equal(audienceAgeLabel({ageRange:{minimum:6,maximum:9}}),"6–9세 추천");
  assert.equal(audienceAgeLabel(null),null);
  assert.equal(difficultyLabel({difficulty:"medium"}),"보통");
  assert.equal(difficultyLabel(null),null);
});
test("Topic list supports kids-only topic suggestions, backed by approved content", () => {
  assert.equal(parseOperation("topic_list",{kids:true}).kids,true);
  assert.equal(parseOperation("topic_list",{}).kids,false);
  const code = readFileSync(new URL("../src/modules/platform/topics.ts",import.meta.url),"utf8");
  assert.match(code,/isSpoiler:false/);
  assert.match(code,/kidsEligible:true/);
  assert.match(code,/safetyStatus:"APPROVED"/);
});
test("Discover fetches public quizzes, supports topic and audience filters and launches individual play", () => {
  const page = readFileSync(new URL("../app/(platform)/discover/page.tsx",import.meta.url),"utf8");
  assert.match(page,/getData\("\/quizzes\?"/);
  assert.match(page,/getData\("\/topics\?limit=100"/);
  assert.match(page,/publicTopics\(quiz\)/);
  assert.match(page,/\/play\/"/);
  assert.doesNotMatch(page,/준비 중<\/span>/);
  const play = readFileSync(new URL("../app/(platform)/play/[quizId]/page.tsx",import.meta.url),"utf8");
  assert.match(play,/request\("\/play"/);
  assert.match(play,/sessionToken/);
  assert.match(play,/\/clue"/);
  assert.match(play,/\/guess"/);
});
