import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseOperation } from "../src/modules/platform/contracts.ts";
import { orderPackQuestions } from "../src/modules/platform/pack-order.ts";
import { ratingSummary } from "../src/modules/quiz/rating-metadata.ts";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const pack="94f0792a-18e6-40c0-a480-0be6d46dbb37";
const ids=[
  pack,"13e472fa-b1e7-484f-bd34-edb30ba3ab3f",
  "b83880b4-7acf-4233-bb05-84c0a00de9b1","3a35a679-c09b-44af-a0a2-7bdf758a2894"
];

test("pack order is explicit metadata with backward compatible creator-order default",()=>{
  assert.equal(parseOperation("pack_create",{title:"A",description:"",quizIds:[pack],locale:"en"}).orderMode,"CREATOR");
  assert.equal(parseOperation("pack_create",{title:"A",quizIds:[pack],orderMode:"RANDOM"}).orderMode,"RANDOM");
  assert.equal(parseOperation("pack_update",{id:pack,orderMode:"RANDOM"}).orderMode,"RANDOM");
  assert.throws(()=>parseOperation("pack_update",{id:pack,orderMode:"SHUFFLE_EVERY_ROUND"}));
  assert.match(read("../../prisma/schema.prisma"),/orderMode\s+String\s+@default\("CREATOR"\)/);
  assert.match(read("app/(creator)/studio/packs/pack-editor.tsx"),/value="RANDOM"/);
});

test("random ordering is a full permutation, never mutates the saved order, and pins once",()=>{
  const initial=[...ids];
  const unchanged=orderPackQuestions(ids,"CREATOR");
  assert.deepEqual(unchanged,initial);
  assert.notEqual(unchanged,ids);
  const random=orderPackQuestions(ids,"RANDOM",()=>0);
  assert.equal(new Set(random).size,ids.length);
  assert.deepEqual([...random].sort(),[...ids].sort());
  assert.notDeepEqual(random,ids);
  assert.deepEqual(ids,initial);
  assert.deepEqual(orderPackQuestions(ids,"RANDOM",()=>0),random);
  assert.throws(()=>orderPackQuestions(ids,"RANDOM",()=>5));
  const runs=read("src/modules/platform/runs.ts");
  assert.match(runs,/orderPackQuestions\(pack\.items\.filter\(item=>ids\.includes\(item\.quizId\)\)/);
  assert.match(runs,/questions:\{create:orderedItems\.map/);
  assert.match(runs,/runToken:authToken\(active\.id,actor\.id\),resumed:true/);
  assert.ok(runs.indexOf("if(active){")<runs.indexOf("orderPackQuestions(pack.items.filter"));
  assert.doesNotMatch(runs.slice(runs.indexOf("export async function runCurrent"),runs.indexOf("export async function runFinish")),/orderPackQuestions/);
});

test("pack social actions require completed play and separate ratings from individual quizzes",()=>{
  assert.equal(parseOperation("pack_review_upsert",{id:pack,locale:"ko",rating:1}).rating,1);
  assert.throws(()=>parseOperation("pack_review_upsert",{id:pack,locale:"ko",rating:5}));
  assert.throws(()=>parseOperation("pack_report_create",{id:pack,reason:"UNSAFE",detail:"X"}));
  assert.equal(ratingSummary(4,0).positivePercent,null);
  assert.equal(ratingSummary(5,0).positivePercent,100);
  const social=read("src/modules/platform/pack-social.ts");
  assert.match(social,/mode:"PACK",lane:"GENERAL"/);
  assert.match(social,/status:"FINISHED"/);
  assert.match(social,/self_review/);
  assert.match(social,/play_required/);
  assert.match(social,/packId_authorId_locale/);
  assert.match(social,/child_reviews_disabled/);
  assert.match(social,/packReport\.create/);
  const schema=read("../../prisma/schema.prisma");
  assert.match(schema,/model PackReview/);
  assert.match(schema,/@@unique\(\[packId, authorId, locale\]\)/);
  assert.match(schema,/model PackReport/);
});

test("Discover uses real server-owned activity, sample floors, current safety and media gates",()=>{
  const server=read("src/modules/platform/discovery.ts");
  assert.match(server,/db\(\)\.playSession\.groupBy/);
  assert.match(server,/db\(\)\.playRun\.groupBy/);
  assert.match(server,/userId:\{not:null\}/);
  assert.match(server,/ratings\.total>=5/);
  assert.match(server,/hardSample>=10/);
  assert.match(server,/moderationStatus:"APPROVED"/);
  assert.match(server,/playableQuizWhere\(locale\)/);
  for(const slug of ["trending","popular","highly_rated","difficult","new"])
    assert.match(server,new RegExp('key:"'+slug+'"'));
  const rest=read("app/api/v1/[...segments]/route.ts");
  for(const op of ["discover_sections","pack_reviews_list","pack_review_upsert","pack_review_remove","pack_report_create","my_pack_insights"])
    assert.match(rest,new RegExp('op:\\s*"'+op+'"'));
  assert.match(read("app/(platform)/discover/page.tsx"),/DiscoverySections/);
  assert.match(read("app/(platform)/discover/page.tsx"),/PackBrowser/);
});

test("sharing is spoiler-free and full-pack review remains optional",()=>{
  const detail=read("app/(platform)/packs/[packId]/page.tsx");
  assert.match(detail,/openGraph:\{title,description/);
  assert.match(detail,/alternates:\{canonical:url\}/);
  assert.match(detail,/PackShare/);
  assert.match(detail,/PackReport/);
  const play=read("app/(platform)/play/page.tsx");
  assert.match(play,/PackFeedback packId=\{packId\}/);
  assert.match(play,/details className="run-rating-review"/);
  assert.match(read("src/modules/platform/social.ts"),/orderMode:pack.orderMode/);
});
