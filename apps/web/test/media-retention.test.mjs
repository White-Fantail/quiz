import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {operations} from "../src/modules/platform/contracts.ts";

const source = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const media = source("src/modules/platform/media.ts");
const library = source("app/(creator)/studio/media/media-library.tsx");

test("current editable and all published localizations protect media, even for drafts",()=>{
  assert.match(media,/LEFT JOIN "QuizLocalization" l ON l\."id" = r\."localizationId"/);
  assert.match(media,/r\."version" = l\."currentVersion"/);
  assert.match(media,/l\."status" = 'PUBLISHED' AND r\."version" = l\."publishedVersion"/);
  assert.match(media,/l\."id" IS NULL AND r\."version" = q\."currentVersion"/);
});

test("unexpired sessions, active runs and future weekly snapshots protect their pinned revisions",()=>{
  assert.match(media,/FROM "PlaySession" s/);
  assert.match(media,/s\."revisionId" = r\."id" AND s\."expiresAt" > CURRENT_TIMESTAMP/);
  assert.doesNotMatch(media,/s\."status" = 'ACTIVE'/);
  assert.match(media,/FROM "PlayRunQuestion" rq/);
  assert.match(media,/JOIN "PlayRun" run/);
  assert.match(media,/run\."status" = 'ACTIVE' AND run\."expiresAt" > CURRENT_TIMESTAMP/);
  for(const table of ["WeeklyQuestion","WeeklyQuestionLocalization"])
    assert.ok(media.includes('FROM "'+table+'"'),table+" snapshots protected");
  assert.match(media,/wc\."status" IN \('SUBMITTED','SCHEDULED'\)/);
  assert.match(media,/wc\."weekEnd" > CURRENT_TIMESTAMP/);
});

test("used/unused returns assets needed for playback, not historical-only IDs",()=>{
  assert.match(media,/const ids = await protectedMediaIds\(user\.id\)/);
  assert.match(media,/p\.usage === "used" \? \{ in: ids \} : \{ notIn: ids \}/);
  assert.doesNotMatch(media,/referencedMediaIds\(/);
  assert.match(library,/Not needed for playback/);
  assert.match(library,/Currently needed/);
  assert.equal(operations.media_list.public,false);
  assert.equal(operations.media_delete.public,false);
});

test("deletion rechecks eligibility, child assets and actor audit inside a serializable transaction",()=>{
  assert.match(media,/db\(\)\.\$transaction\(async tx => \{/);
  assert.match(media,/protectedMediaIds\(user\.id,tx\)/);
  assert.match(media,/tx\.mediaAsset\.count\(\{where:\{parentId:item\.id,deletedAt:null\}/);
  assert.match(media,/tx\.mediaAsset\.updateMany\(/);
  assert.match(media,/status:"DELETED",deletedAt/);
  assert.match(media,/tx\.auditLog\.create/);
  assert.match(media,/action:"media\.delete"/);
  assert.match(media,/isolationLevel:"Serializable"/);
  assert.match(media,/await deleteObject\(old\.storageKey\)/);
  assert.doesNotMatch(media,/DELETE FROM "QuizRevision"/);
});

test("explicit client confirmation remains mandatory for REST and MCP",()=>{
  const id="00000000-0000-0000-0000-000000000000";
  assert.equal(operations.media_delete.schema.safeParse({id,confirm:true}).success,true);
  assert.equal(operations.media_delete.schema.safeParse({id}).success,false);
});
