import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const root=process.cwd();
const source=path=>readFileSync(join(root,path),"utf8");
const operations=source("apps/web/src/modules/platform/operations.ts");
const contracts=source("apps/web/src/modules/platform/contracts.ts");
const rest=source("apps/web/app/api/v1/[...segments]/route.ts");
const moderation=source("apps/web/src/modules/platform/moderation.ts");
const appeals=source("apps/web/src/modules/platform/moderation-appeals.ts");

test("all moderation REST endpoints have matching shared MCP operations",()=>{
  const names=[
    "admin_moderation_policy_get","admin_moderation_policy_update","admin_moderation_queue",
    "admin_moderation_detail","admin_moderation_review","admin_moderation_appeals",
    "admin_moderation_appeal_review","admin_publisher_get","admin_publisher_set",
    "my_moderation_inbox","my_moderation_read","my_moderation_appeal"
  ];
  for(const name of names){
    assert.match(operations,new RegExp('case "'+name+'"'));
    assert.match(contracts,new RegExp(name+':\\s*\\{public:false'));
    assert.ok(rest.includes('op:"'+name+'"'),name+" missing REST endpoint");
  }
});
test("creator report paths use shared state machine, not separate logic",()=>{
  assert.match(source("apps/web/src/modules/platform/social.ts"),/submitReport\("QUIZ",p,actor\)/);
  assert.match(source("apps/web/src/modules/platform/pack-social.ts"),/submitReport\("PACK",p,actor\)/);
  assert.match(moderation,/FOR UPDATE/);
  assert.match(moderation,/recently reported this content/i);
  assert.match(moderation,/minimumEstablishedReporters/);
  assert.match(moderation,/shouldAutoHold/);
  assert.match(moderation,/POLICY_UPDATE/);
});
test("publishing workflows use transaction-time user row locks",()=>{
  assert.match(moderation,/FROM "User" WHERE "id"=\$\{user\.id\} FOR SHARE/);
  for(const path of [
    "apps/web/src/modules/platform/quiz.ts",
    "apps/web/src/modules/platform/social.ts",
    "apps/web/src/modules/platform/translations.ts"
  ]) assert.match(source(path),/assertPublishingAllowedInTx\(tx,/);
});
test("public reads and active playback require ACTIVE safety",()=>{
  for(const path of [
    "apps/web/src/modules/platform/content-locale.ts",
    "apps/web/src/modules/platform/feature-eligibility.ts",
    "apps/web/src/modules/platform/discovery.ts",
    "apps/web/src/modules/platform/play.ts",
    "apps/web/src/modules/platform/runs.ts"
  ]){
    const contents=source(path);
    assert.match(contents,/safetyStatus/);
    assert.match(contents,/"ACTIVE"/);
    assert.ok(!contents.includes('safetyStatus:{not:"RESTRICTED"}'),path+" has old public gate");
  }
});
test("creator identity is verified for appeals; reporter IDs are not exposed to creator inbox",()=>{
  assert.match(appeals,/target\.authorId!==user\.id/);
  assert.match(appeals,/id!==user\.id/);
  assert.match(appeals,/An appeal for this item is already pending/);
  assert.match(appeals,/userId:user\.id/);
  const inbox=appeals.slice(appeals.indexOf("export async function myModerationInbox"),
    appeals.indexOf("export async function myModerationRead"));
  assert.ok(!inbox.includes("reporterId"));
});
test("private appeal and notice migrations preserve original report tables",()=>{
  const migration=source("prisma/migrations/20261014100000_moderation_appeals_and_notifications/migration.sql");
  assert.match(migration,/CREATE TABLE "ModerationNotice"/);
  assert.match(migration,/CREATE TABLE "ModerationAppeal"/);
  assert.match(migration,/ModerationAppeal_one_open_per_target/);
  assert.ok(!/DROP TABLE/.test(migration));
});
