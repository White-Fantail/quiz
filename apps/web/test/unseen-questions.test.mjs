import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {selectUnseen} from "../src/modules/platform/unseen-questions.ts";
import {operations,parseOperation} from "../src/modules/platform/contracts.ts";

const first="94f0792a-18e6-40c0-a480-0be6d46dbb37";
const second="e60f87e5-617a-4c93-b5a2-1bbcb36ab9d2";

test("fresh selection excludes seen questions and never repeats to fill a shortage",()=>{
  const bank=[{id:first},{id:second}];
  assert.deepEqual(selectUnseen(bank,[first]),[{id:second}]);
  assert.deepEqual(selectUnseen(bank,[first,second]),[]);
  assert.equal(selectUnseen(bank,[first,second]).length<5,true);
});
test("REST and MCP share validated browser-history exclusions",()=>{
  const parsed=parseOperation("run_start",{mode:"RANDOM_FIVE",lane:"GENERAL",avoidQuizIds:[first,second]});
  assert.deepEqual(parsed.avoidQuizIds,[first,second]);
  assert.deepEqual(parseOperation("run_current",{runId:first,runToken:"a".repeat(40)}).avoidQuizIds,[]);
  assert.throws(()=>parseOperation("run_start",{mode:"RANDOM_FIVE",avoidQuizIds:["invalid"]}));
  assert.equal("run_current" in operations,true);
});
test("server enforces weekly first-exposure ranking guard and pool depletion",()=>{
  const code=readFileSync(new URL("../src/modules/platform/runs.ts",import.meta.url),"utf8");
  assert.ok(code.includes('pr."officialEligible"=TRUE'));
  assert.ok(code.includes('pr."officialEligible"=TRUE'));
  assert.ok(code.includes("const choice=shuffle(selectUnseen"));
  assert.ok(code.includes('exhausted:done.status==="FINISHED"'));
});
test("UI offers optional quick five, continuous random play and Discover instead of weekly promotion",()=>{
  const code=readFileSync(new URL("../app/(platform)/play/page.tsx",import.meta.url),"utf8");
  assert.match(code,/play-practice/);
  assert.doesNotMatch(code,/weekly-spotlight/);
  assert.match(code,/문제와 퀴즈팩 둘러보기/);
  assert.match(code,/새로운 5문제 더 풀기/);
  assert.ok(code.includes("rememberQuiz(next.quizId)"));
});
