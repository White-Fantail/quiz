import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ratingSummary,MIN_PUBLIC_RATINGS} from "../src/modules/quiz/rating-metadata.ts";
import {parseOperation} from "../src/modules/platform/contracts.ts";
const id="94f0792a-18e6-40c0-a480-0be6d46dbb37";
const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("public sentiment hides tiny samples and is not the answer success rate",()=>{
  assert.equal(MIN_PUBLIC_RATINGS,5);
  assert.deepEqual(ratingSummary(0,0),{positive:0,negative:0,total:0,positivePercent:null});
  assert.equal(ratingSummary(4,0).positivePercent,null);
  assert.equal(ratingSummary(3,2).positivePercent,60);
  assert.equal(ratingSummary(90,10).positivePercent,90);
});
test("run feedback uses a signed token; account reactions are strictly validated",()=>{
  assert.equal(parseOperation("run_feedback",{runId:id,runToken:"x".repeat(32)}).runId,id);
  assert.equal(parseOperation("review_remove",{quizId:id}).quizId,id);
  assert.equal(parseOperation("review_upsert",{quizId:id,rating:1}).rating,1);
  assert.throws(()=>parseOperation("run_feedback",{runId:id,runToken:"short"}));
  assert.throws(()=>parseOperation("review_upsert",{quizId:id,rating:5}));
  assert.equal("authorId" in parseOperation("review_remove",{quizId:id,authorId:"other"}),false);
});
test("Discover and run UI rate finished questions, not the middle of a five-round game",()=>{
  const continuous=source("../app/(platform)/play/page.tsx");
  const single=source("../app/(platform)/play/[quizId]/page.tsx");
  const discover=source("../app/(platform)/discover/page.tsx");
  const service=source("../src/modules/platform/social.ts");
  const feedback=source("../src/modules/platform/runs.ts");
  assert.match(continuous,/run\.status!=="FINISHED"/);
  assert.match(continuous,/questionsToRate\.map/);
  assert.match(single,/status !== "ACTIVE" && <div className="single-rating-review">/);
  assert.match(discover,/<RatingBadge ratings={quiz\.ratings}/);
  assert.match(service,/playSession\.findFirst/);
  assert.match(service,/quizId_authorId_locale_kind/);
  assert.match(service,/authorId:user\.id/);
  assert.match(feedback,/checkedRun\(p\.runId,p\.runToken,actor\)/);
  assert.match(feedback,/status:\{in:\["SOLVED","FAILED"\]\}/);
});
