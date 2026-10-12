import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseOperation, operations } from "../src/modules/platform/contracts.ts";
import { discoverQuery } from "../src/modules/quiz/discover-metadata.ts";

const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const id="94f0792a-18e6-40c0-a480-0be6d46dbb37";
test("catalog and gameplay validate supported locale and refuse unsupported values",()=>{
  for(const name of ["quiz_list","quiz_get","topic_list","pack_list","play_start","run_start"]){
    const obj = name==="quiz_get" ? {id} : name==="play_start" ? {quizId:id}
      : name==="run_start" ? {mode:"RANDOM_FIVE"} : {};
    assert.equal(parseOperation(name,obj).locale,"en",name);
    assert.equal(parseOperation(name,{...obj,locale:"ko"}).locale,"ko",name);
    assert.throws(()=>parseOperation(name,{...obj,locale:"ja"}),name);
    assert.throws(()=>parseOperation(name,{...obj,locale:"und"}),name);
  }
  assert.equal(parseOperation("run_current",{runId:id,runToken:"x".repeat(40)}).locale,undefined);
  assert.throws(()=>parseOperation("run_current",{runId:id,runToken:"x".repeat(40),locale:"und"}));
  assert.equal(parseOperation("quiz_create",{title:"A",prompt:"B",answer:{canonical:"C",aliases:[]},
    clues:[{type:"text",text:"D"}]}).locale,undefined);
  assert.equal(parseOperation("pack_create",{title:"A",quizIds:[id]}).locale,"und");
});
test("original language classification requires creator confirmation and is never a safety edit",()=>{
  for(const name of ["quiz_language_set","pack_language_set"]){
    assert.equal(operations[name].public,false);
    assert.throws(()=>parseOperation(name,{id,locale:"en"}));
    assert.throws(()=>parseOperation(name,{id,locale:"und",confirm:true}));
    assert.equal(parseOperation(name,{id,locale:"ko",confirm:true}).locale,"ko");
  }
  const quiz=read("src/modules/platform/quiz.ts");
  const social=read("src/modules/platform/social.ts");
  assert.match(quiz,/authorId:owner.id/);
  assert.match(quiz,/quiz.language.classify/);
  assert.match(social,/pack.language.classify/);
  assert.match(quiz,/locale_already_classified/);
});
test("server-scoped catalog queries and paging enforce published localization before fetching",()=>{
  const quiz=read("src/modules/platform/quiz.ts");
  const social=read("src/modules/platform/social.ts");
  const topic=read("src/modules/platform/topics.ts");
  const predicate=read("src/modules/platform/content-locale.ts");
  assert.match(predicate,/locale, status: "PUBLISHED"/);
  assert.match(predicate,/safetyStatus: "APPROVED"/);
  assert.match(quiz,/where:.*?\bquiz/); // public query is guarded by helper
  assert.match(quiz,/playableQuizWhere\(locale/);
  assert.match(quiz,/skip: p.offset, take: p.limit/);
  assert.match(quiz,/currentPlayableRevision\(id, locale\)/);
  assert.match(topic,/localizations:\s*\{some:\{locale/);
  assert.match(topic,/isSpoiler:false/);
  assert.match(social,/items: \{ some: \{\}, every: \{ quiz: playableQuizWhere\(locale\) \} \}/);
});
test("play sessions and random/pack snapshots pin matching locale and revisions",()=>{
  const play=read("src/modules/platform/play.ts");
  const runs=read("src/modules/platform/runs.ts");
  const schema=read("../../prisma/schema.prisma");
  const migration=read("../../prisma/migrations/20261012080000_language_eligible_play/migration.sql");
  assert.match(play,/currentPlayableRevision\(quiz.id, p.locale\)/);
  assert.match(play,/revision.localization\?\.locale !== session.locale/);
  assert.match(runs,/randomChoices\(run.lane as Lane,run.locale as Locale/);
  assert.match(runs,/playableQuizWhere\(locale,lane\)/);
  assert.match(runs,/packId:pack.id,packVersion:pack.currentVersion/);
  assert.match(runs,/publishedVersion/);
  assert.match(runs,/run.locale!==p.locale/);
  assert.match(runs,/revision.localization\?\.locale!==run.locale/);
  assert.doesNotMatch(schema,/model WeeklyChallenge|model WeeklyQuestion/);
  assert.match(migration,/ALTER TABLE "PlayRun" ADD COLUMN "locale"/);
  assert.match(migration,/ALTER TABLE "PlaySession" ADD COLUMN "locale"/);
  assert.doesNotMatch(migration,/DROP TABLE/);
  assert.equal(new URLSearchParams(discoverQuery({locale:"ko",kids:false,offset:12,limit:13})).get("locale"),"ko");
  const disc=read("app/(platform)/discover/page.tsx");
  const multi=read("app/(platform)/play/page.tsx");
  const solo=read("app/(platform)/play/[quizId]/page.tsx");
  assert.match(disc,/discoverQuery\(\{ answerType, topic, kids, locale,/);
  assert.match(multi,/avoidQuizIds:rememberedQuizzes\(\),locale/);
  assert.match(solo,/\{ quizId, kids, locale \}/);
});
