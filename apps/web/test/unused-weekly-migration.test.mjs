import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { operations, parseOperation } from "../src/modules/platform/contracts.ts";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const exists=(p)=>existsSync(new URL("../"+p,import.meta.url));

test("weekly tables and relations are removed only after a fail-closed empty-data preflight",()=>{
 const sql=read("../../prisma/migrations/20261013040000_remove_unused_weekly_challenges/migration.sql");
 const schema=read("../../prisma/schema.prisma");
 for(const table of ["WeeklyChallenge","WeeklyQuestion","WeeklyQuestionLocalization"]){
   assert.match(sql,new RegExp('EXISTS \\(SELECT 1 FROM "'+table+'"\\)'));
   assert.match(sql,new RegExp('DROP TABLE "'+table+'"'));
   assert.doesNotMatch(schema,new RegExp("model "+table+" \\{"));
 }
 assert.match(sql,/IF EXISTS \(SELECT 1 FROM "PlayRun" WHERE "mode" = 'WEEKLY' OR "weeklyId" IS NOT NULL\)/);
 assert.match(sql,/RAISE EXCEPTION 'Cannot remove weekly challenge schema/);
 assert.doesNotMatch(sql,/TRUNCATE|CASCADE|DELETE FROM "PlayRun"|DROP TABLE "PlayRun"/);
 assert.match(sql,/ALTER TABLE "PlayRun" DROP COLUMN "weeklyId"/);
 assert.match(sql,/ALTER TABLE "PlayRun" DROP COLUMN "officialEligible"/);
 assert.doesNotMatch(schema,/weeklyId|officialEligible|WeeklyChallenge|WeeklyQuestion/);
});

test("remaining run modes are random five, infinite and creator packs; migrated constraint accepts PACK",()=>{
 const sql=read("../../prisma/migrations/20261013040000_remove_unused_weekly_challenges/migration.sql");
 assert.match(sql,/DROP CONSTRAINT "PlayRun_mode_check"/);
 assert.match(sql,/CHECK \("mode" IN \('RANDOM_FIVE', 'INFINITE', 'PACK'\)\)/);
 const modes=["RANDOM_FIVE","INFINITE","PACK"];
 for(const mode of modes)assert.equal(parseOperation("run_start",{mode}).mode,mode);
 assert.throws(()=>parseOperation("run_start",{mode:"WEEKLY"}));
 assert.doesNotMatch(read("src/modules/platform/runs.ts"),/weeklyQuestion|weeklyChallenge|WEEKLY/);
 assert.doesNotMatch(read("src/modules/platform/play.ts"),/weeklyQuestion|weeklyChallenge/);
});

test("weekly REST and MCP actions, unused admin/creator screens and Kids modes are absent",()=>{
 const rest=read("app/api/v1/[...segments]/route.ts");
 const service=read("src/modules/platform/operations.ts");
 const registry=read("src/modules/platform/contracts.ts");
 for(const name of ["weekly_current","weekly_submit","weekly_publish","weekly_proposals",
    "weekly_suspend","weekly_insights","weekly_standings"]){
   assert.equal(Object.hasOwn(operations,name),false);
   assert.ok(!rest.includes(name),name);
   assert.ok(!service.includes(name),name);
   assert.ok(!registry.includes(name),name);
 }
 for(const old of ["app/admin/weekly/page.tsx","app/(creator)/studio/weekly/page.tsx",
   "src/modules/platform/weekly-clock.ts"])assert.equal(exists(old),false,old);
 assert.doesNotMatch(read("../kids/app/game.tsx"),/WEEKLY/);
 assert.doesNotMatch(read("../kids/src/web/Preview.tsx"),/weekly/);
});

test("media, safety and Discover no longer query dropped tables",()=>{
 for(const p of ["src/modules/platform/media.ts","src/modules/platform/discovery.ts",
    "src/modules/platform/feature-eligibility.ts","src/modules/platform/pack-social.ts"]){
   assert.doesNotMatch(read(p),/WeeklyChallenge|WeeklyQuestion|weeklyQuestion|weekEnd/);
 }
 assert.match(read("src/modules/platform/media.ts"),/FROM "PlayRunQuestion" rq/);
 assert.match(read("src/modules/platform/media.ts"),/FROM "PlaySession" s/);
});
