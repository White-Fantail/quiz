import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { utcWeekStart, scoreRanks, WEEK_MS } from "../src/modules/platform/weekly-clock.ts";
import { operations, parseOperation } from "../src/modules/platform/contracts.ts";

const load=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const a="94f0792a-18e6-40c0-a480-0be6d46dbb37";
const b="e60f87e5-617a-4c93-b5a2-1bbcb36ab9d2";
const c="e12701cf-2279-4929-9cce-05516b563334";
const d="c966aafd-17c6-45b7-a2f1-f1c4daec166e";
const e="87f521d4-922b-4d65-81c4-a35b6bca5b20";

test("all users see identical UTC Monday weekly boundaries, including year rollover",()=>{
  assert.equal(utcWeekStart(new Date("2026-10-11T23:59:00Z")).toISOString(),"2026-10-05T00:00:00.000Z");
  assert.equal(utcWeekStart(new Date("2026-10-12T00:01:00Z")).toISOString(),"2026-10-12T00:00:00.000Z");
  assert.equal(utcWeekStart(new Date("2027-01-01T18:00:00Z")).toISOString(),"2026-12-28T00:00:00.000Z");
  assert.equal(WEEK_MS,604800000);
});

test("weekly standings award joint places on tied scores instead of subjective speed tiebreakers",()=>{
  const rows=scoreRanks([{score:500},{score:500},{score:400},{score:400},{score:300}]);
  assert.deepEqual(rows.map(x=>x.rank),[1,1,3,3,5]);
});

test("five owned distinct question IDs required and a confirmed staff action controls publishing",()=>{
  const form={lane:"GENERAL",weekStart:"2026-10-12",title:"Celebrity quiz",description:"Let's play",quizIds:[a,b,c,d,e]};
  assert.equal(parseOperation("weekly_submit",form).quizIds.length,5);
  assert.throws(()=>parseOperation("weekly_submit",{...form,quizIds:[a,a,c,d,e]}));
  assert.throws(()=>parseOperation("weekly_submit",{...form,quizIds:[a,b]}));
  assert.throws(()=>parseOperation("weekly_submit",{...form,lane:"ANY"}));
  assert.throws(()=>parseOperation("weekly_publish",{challengeId:a,verifiedHost:true}));
  assert.equal(parseOperation("weekly_publish",{challengeId:a,verifiedHost:false,confirm:true}).confirm,true);
  assert.throws(()=>parseOperation("weekly_suspend",{challengeId:a,reason:"Not available"}));
  assert.throws(()=>parseOperation("run_finish",{runId:a,runToken:"b".repeat(40)}));
});

test("REST, MCP, domain dispatcher all expose weekly, run and moderation lifecycle",()=>{
  const rest=load("app/api/v1/[...segments]/route.ts");
  const ops=load("src/modules/platform/operations.ts");
  const mcp=load("app/api/mcp/route.ts");
  const names=["weekly_current","weekly_submit","weekly_publish","weekly_proposals","weekly_suspend",
    "weekly_standings","run_start","run_current","run_finish","run_history"];
  for(const name of names){
    assert.ok(name in operations,name);
    assert.match(rest,new RegExp('op: "'+name+'"'));
    assert.match(ops,new RegExp('case "'+name+'"'));
  }
  assert.match(mcp,/Object\.keys\(operations\)/);
  assert.match(mcp,/execute\(name, args, actor\)/);
});

test("frozen weekly revisions, verified authors and first-attempt uniqueness are enforced server side",()=>{
  const source=load("src/modules/platform/runs.ts");
  const play=load("src/modules/platform/play.ts");
  const schema=load("../../prisma/schema.prisma");
  const migration=load("../../prisma/migrations/20261011120000_weekly_play/migration.sql");
  assert.match(source,/quiz\.authorId!==item\.hostId/);
  assert.match(source,/q\.quiz\.currentVersion!==q\.revision\.version/);
  assert.match(source,/editionAvailable/);
  assert.match(source,/user\.role!=="ADMIN"/);
  assert.match(source,/randomChoices/);
  assert.match(source,/userExcludedQuestions/);
  assert.match(source,/selectUnseen/);
  assert.match(source,/officialEligible/);
  assert.doesNotMatch(source,/candidates\\.length>=count\\?candidates:eligible/);
  assert.doesNotMatch(source,/take:30,select:\\{quizId:true\\}/);
  assert.match(source,/weeklyQuestion\.findMany/);
  assert.match(source,/u\."leaderboardEligible"=TRUE/);
  assert.match(source,/return runStart\(p,actor\)/);
  assert.match(play,/tx\.playRun\.updateMany/);
  assert.match(play,/tx\.playSession\.updateMany/);
  assert.match(play,/finished\?\{status:"FINISHED"/);
  assert.match(migration,/PlayRun_one_weekly_account/);
  assert.match(migration,/WeeklyChallenge_unique_scheduled/);
  assert.match(schema,/model WeeklyChallenge/);
  assert.match(schema,/officialEligible\\s+Boolean/);
  assert.match(source,/pr\\."officialEligible"=TRUE/);
});

test("kids weekly eligibility excludes pending and restricted questions and never exposes kid ranking",()=>{
  const source=load("src/modules/platform/runs.ts");
  assert.match(source,/safetyStatus: "APPROVED", kidsEligible: true/);
  assert.match(source,/edition\.lane!=="GENERAL"/);
  assert.match(source,/RANK\(\) OVER/);
});

test("web play is wired to server-authoritative gameplay and media playback",()=>{
  const view=load("app/(platform)/play/page.tsx");
  assert.match(view,/api\("\/runs"/);
  assert.match(view,/\/current","POST"/);
  assert.match(view,/\/guess","POST"/);
  assert.match(view,/\/clue","POST"/);
  assert.match(view,/\/media","POST"/);
  assert.match(view,/lane==="KIDS"/);
  assert.doesNotMatch(view,/demoQuiz/);
});

test("adult public ranking requires both opt-in consent and trusted verification",()=>{
  const source=load("src/modules/platform/analytics.ts");
  const run=load("src/modules/platform/runs.ts");
  const schema=load("../../prisma/schema.prisma");
  assert.match(source,/leaderboardOptIn: true/);
  assert.match(source,/admin\.role!=="ADMIN"/);
  assert.match(run,/u\."leaderboardOptIn"=TRUE/);
  assert.match(run,/pr\."userId" <>/);
  assert.match(schema,/leaderboardOptIn\s+Boolean\s+@default\(false\)/);
  assert.throws(()=>parseOperation("ranking_optin",{enabled:true}));
  assert.equal(parseOperation("ranking_optin",{enabled:true,confirm:true}).enabled,true);
  assert.throws(()=>parseOperation("adult_verify",{userId:"some-user-id",verified:true,reason:"Identity checked"}));
});

test("child safety moderation is privileged, human-approved and revision-bound",()=>{
  const quiz=load("src/modules/platform/quiz.ts");
  const media=load("src/modules/platform/media.ts");
  assert.match(quiz,/admin\.role!=="ADMIN"/);
  assert.match(quiz,/currentVersion:quiz\.currentVersion/);
  assert.match(quiz,/changed\.count!==1/);
  assert.match(quiz,/validateMediaReferences\(quiz\.authorId/);
  assert.match(media,/user\.role!=="ADMIN"/);
  assert.throws(()=>parseOperation("quiz_review",{id:a,verdict:"APPROVED",kidsEligible:true,reason:"Reviewed"}));
  assert.equal(parseOperation("quiz_review",{id:a,verdict:"APPROVED",kidsEligible:true,reason:"Reviewed",confirm:true}).kidsEligible,true);
  const routes=load("app/api/v1/[...segments]/route.ts");
  for(const name of ["quiz_review_get","quiz_review","media_review_get","media_review"])
    assert.match(routes,new RegExp('op: "'+name+'"'));
});
