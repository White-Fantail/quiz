import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runTargetCount, completesRun } from "../src/modules/platform/run-length.ts";

const load = (p) => readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("legacy five-round runs and future long packs have correct server-side completion",()=>{
  assert.equal(runTargetCount({mode:"WEEKLY"}),5);
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

test("retired weekly publication cannot be initiated, but archival paths remain",()=>{
  const runs=load("src/modules/platform/runs.ts");
  assert.match(runs,/weekly_retired/);
  assert.match(runs,/export async function weeklyInsights/);
  assert.match(runs,/export async function weeklySuspend/);
  const ui=load("app/(platform)/play/page.tsx");
  assert.doesNotMatch(ui,/weekly-spotlight|weekly\/current|weekly-ranking|start\("WEEKLY"\)/);
  assert.match(ui,/previous\.total!==null/);
  assert.doesNotMatch(load("app/(creator)/studio/page.tsx"),/studio\/weekly/);
  assert.doesNotMatch(load("../../apps/kids/app/(tabs)/challenge.tsx"),/WEEKLY/);
});
