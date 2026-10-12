import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runTargetCount, completesRun } from "../src/modules/platform/run-length.ts";

const load = (p) => readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("five-round runs and longer packs have correct server-side completion",()=>{
  assert.equal(runTargetCount({mode:"RANDOM_FIVE",targetCount:5}),5);
  assert.equal(runTargetCount({mode:"PACK",targetCount:30}),30);
  assert.equal(runTargetCount({mode:"INFINITE"}),null);
  assert.equal(completesRun({mode:"PACK",targetCount:30,currentIndex:28}),false);
  assert.equal(completesRun({mode:"PACK",targetCount:30,currentIndex:29}),true);
  assert.equal(completesRun({mode:"RANDOM_FIVE",currentIndex:4}),true);
  assert.equal(completesRun({mode:"INFINITE",currentIndex:100}),false);
  assert.match(load("src/modules/platform/play.ts"),/completesRun\(run\)/);
  assert.doesNotMatch(load("src/modules/platform/play.ts"),/currentIndex===4/);
  assert.match(load("../../prisma/schema.prisma"),/targetCount\s+Int\?/);
  assert.match(load("../../prisma/migrations/20261013000000_play_run_target_count/migration.sql"),/UPDATE "PlayRun" SET "targetCount" = 5/);
});

test("weekly challenge is removed from server contracts and UI",()=>{
  const runs=load("src/modules/platform/runs.ts");
  const api=load("src/modules/platform/contracts.ts");
  const ui=load("app/(platform)/play/page.tsx");
  assert.doesNotMatch(runs,/weeklyChallenge|weeklyQuestion|mode==="WEEKLY"/);
  assert.doesNotMatch(api,/weekly_current|weekly_submit|weekly_standings|mode: z.enum\(\["WEEKLY"/);
  assert.doesNotMatch(ui,/weekly-spotlight|weekly\/current|weekly-ranking|start\("WEEKLY"\)/);
  assert.match(ui,/previous.total!==null/);
  assert.doesNotMatch(load("app/(creator)/studio/page.tsx"),/studio\/weekly/);
  assert.doesNotMatch(load("../../apps/kids/app/(tabs)/challenge.tsx"),/WEEKLY/);
});
