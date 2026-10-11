import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {detectContentLocale,detectQuizLocale} from "../src/modules/platform/translation-language.ts";
import {operations,parseOperation} from "../src/modules/platform/contracts.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const id="94f0792a-18e6-40c0-a480-0be6d46dbb37";
const question={title:"City quiz",prompt:"Which South Island city is the Garden City?",
  answer:{canonical:"Christchurch",aliases:[]},clues:[{type:"text",text:"It is on the South Island."}]};
test("language inference is conservative, creator can override",()=>{
  assert.equal(detectContentLocale("뉴질랜드의 가든 시티는 어디일까요?"),"ko");
  assert.equal(detectContentLocale("Which city is the Garden City?"),"en");
  assert.equal(detectContentLocale("Hello 한국어 mixed"),"und");
  assert.equal(detectQuizLocale(question),"en");
  assert.equal(parseOperation("quiz_create",question).locale,undefined);
  assert.equal(parseOperation("quiz_create",{...question,locale:"ko"}).locale,"ko");
});
test("translation operation identity, validation and review controls",()=>{
  const names=["quiz_languages","quiz_translation_get","quiz_translation_generate",
    "quiz_translation_save","quiz_translation_publish","quiz_translation_hide"];
  for(const name of names)assert.equal(operations[name].public,false,name);
  const fields={...question,clues:[{type:"text",text:"남섬에 있습니다."}]};
  const draft={id,locale:"ko",sourceRevisionId:id,expectedVersion:0,fields};
  assert.equal(parseOperation("quiz_translation_save",draft).expectedVersion,0);
  assert.throws(()=>parseOperation("quiz_translation_save",{...draft,fields:{...fields,clues:[]}}));
  assert.throws(()=>parseOperation("quiz_translation_get",{id,locale:"ja"}));
  assert.throws(()=>parseOperation("quiz_translation_publish",{id,locale:"ko",expectedVersion:1,reviewed:true}));
  assert.throws(()=>parseOperation("quiz_translation_publish",{id,locale:"ko",expectedVersion:1,reviewed:false,confirm:true}));
  assert.equal(parseOperation("quiz_translation_publish",{id,locale:"ko",expectedVersion:1,reviewed:true,confirm:true}).confirm,true);
  assert.throws(()=>parseOperation("quiz_translation_hide",{id,locale:"ko"}));
});
test("localized version pointers, immutable session IDs, and translation review safety",()=>{
  const schema=read("../../prisma/schema.prisma");
  const migration=read("../../prisma/migrations/20261012100000_translation_versions/migration.sql");
  const svc=read("src/modules/platform/translations.ts");
  const publicCode=read("src/modules/platform/content-locale.ts");
  const runs=read("src/modules/platform/runs.ts");
  const studio=read("app/(creator)/studio/quizzes/[quizId]/quiz-detail.tsx");
  const ui=read("app/(creator)/studio/quizzes/[quizId]/translation-manager.tsx");
  assert.match(schema,/publishedVersion\s+Int\?/);
  assert.match(schema,/@@unique\(\[localizationId, version\]\)/);
  assert.doesNotMatch(schema,/@@unique\(\[quizId, version\]\)/);
  assert.match(migration,/DROP INDEX IF EXISTS "QuizRevision_quizId_version_key"/);
  assert.match(migration,/UPDATE "QuizLocalization" SET "publishedVersion"="currentVersion"/);
  assert.match(publicCode,/version: translation.publishedVersion/);
  assert.match(runs,/loc\.publishedVersion/);
  assert.match(svc,/data:\{currentVersion:next,sourceRevisionId:source.id\}/);
  assert.match(svc,/publishedVersion:p.expectedVersion,status:"PUBLISHED"/);
  assert.match(svc,/validateLocalizedClues\(source\.clues,fields\.clues\)/);
  assert.match(svc,/kind:\{in:\["audio","video"\]\}/);
  assert.match(svc,/created:false,published:false/);
  assert.match(svc,/safetyStatus:"PENDING",kidsEligible:false/);
  const eligibility=read("src/modules/platform/content-locale.ts");
  const play=read("src/modules/platform/play.ts");
  assert.match(eligibility,/lane==="KIDS"\?\{origin:/);
  assert.match(play,/locale_safety_review_pending/);
  assert.match(studio,/TranslationManager/);
  assert.match(ui,/reviewed:true,confirm:true/);
});
test("REST and MCP routing parity for all six translation actions",()=>{
  const ops=read("src/modules/platform/operations.ts");
  const route=read("app/api/v1/[...segments]/route.ts");
  for(const name of ["quiz_languages","quiz_translation_get","quiz_translation_generate",
    "quiz_translation_save","quiz_translation_publish","quiz_translation_hide"]){
    assert.match(ops,new RegExp('case "'+name+'"'));
    assert.match(route,new RegExp('op: "'+name+'"'));
  }
});
