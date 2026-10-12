import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isCorrectAnswer, scoreForClues } from "@quizdip/domain";
import { operations } from "../src/modules/platform/contracts.ts";

const source = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const page = source("app/(creator)/studio/quizzes/[quizId]/preview/page.tsx");
const player = source("app/(creator)/studio/quizzes/[quizId]/preview/studio-quiz-preview.tsx");
const list = source("app/(creator)/studio/studio-workspace.tsx");
const details = source("app/(creator)/studio/quizzes/[quizId]/quiz-detail.tsx");

test("preview is server-side owner checked, not merely hidden in navigation",()=>{
  assert.match(page,/auth\.api\.getSession/);
  assert.match(page,/authorId:session\.user\.id/);
  assert.match(page,/if\(!owned\) notFound\(\)/);
  assert.match(player,/!data\.answer\|\|!Array\.isArray\(data\.clues\)/);
});

test("draft, hidden and public quizzes share the Test play link",()=>{
  assert.match(list,/item\.id\+"\/preview"/);
  assert.match(details,/quiz\.id\+"\/preview"/);
  assert.doesNotMatch(list,/item\.publication==="PUBLISHED".*preview/);
  assert.match(player,/quiz\.publication==="DRAFT"/);
  assert.match(player,/quiz\.publication==="HIDDEN"/);
});

test("preview reuses owner GET APIs with no server-side gameplay or rating mutations",()=>{
  assert.match(player,/ownerGet<Quiz>\("\/quizzes\//);
  assert.match(player,/ownerGet<Media>\("\/media\//);
  assert.match(player,/method:"GET"/);
  assert.match(player,/clues\.slice\(0,clueIndex\)/);
  assert.doesNotMatch(player,/fetch\("\/api\/v1\/(play|runs|reviews)/);
  assert.doesNotMatch(player,/method:\s*["'](POST|PUT|PATCH|DELETE)["']/);
  assert.doesNotMatch(player,/localStorage|sessionStorage|navigator\.sendBeacon/);
  assert.match(player,/isCorrectAnswer/);
  assert.match(player,/scoreForClues/);
  assert.equal(operations.quiz_get.public,true);
  assert.equal(operations.media_get.public,false);
});

test("local answer checker and hypothetical score are pure, not persisted",()=>{
  assert.equal(isCorrectAnswer({canonical:"Elephant",aliases:["elephants"]}," elephants "),true);
  assert.equal(isCorrectAnswer({canonical:"Elephant",aliases:["elephants"]},"lion"),false);
  assert.ok(scoreForClues(5,1)>scoreForClues(5,5));
});

test("preview media URL is requested as it is revealed, with readable non-media fallback",()=>{
  assert.match(player,/\.slice\(0,clueIndex\)/);
  assert.match(player,/item\.kind==="image"/);
  assert.match(player,/item\.kind==="audio"/);
  assert.match(player,/item\.kind==="video"/);
  assert.match(player,/clue\.type==="map"/);
  assert.match(player,/studio-preview-notice/);
  assert.match(player,/onClick=\{reset\}/);
});
