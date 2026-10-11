import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseOperation } from "../src/modules/platform/contracts.ts";
import { normalizeTopicInputs, normalizeTopicKey } from "../src/modules/platform/topic-normalization.ts";
const id="94f0792a-18e6-40c0-a480-0be6d46dbb37";
const quiz={title:"Sejong",prompt:"Who?",answer:{canonical:"세종대왕",aliases:["Sejong"]},
  answerType:"person",clues:[{type:"text",text:"A ruler"}],
  topics:["한국사",{name:"세종대왕",isSpoiler:false}," 한국사 "," History "],
  creatorIntent:{ageRange:{minimum:6,maximum:9}},
  recommendedAudience:{ageRange:{minimum:10},difficulty:"medium"}};
test("quiz metadata separates mode, kind, topics and recommendations",()=>{
 const parsed=parseOperation("quiz_create",quiz);
 assert.equal(parsed.mode,"progressive-clues");
 assert.equal(parsed.answerType,"person");
 assert.equal(parsed.recommendedAudience.difficulty,"medium");
 assert.throws(()=>parseOperation("quiz_create",{...quiz,mode:"guess-person"}));
 assert.throws(()=>parseOperation("quiz_create",{...quiz,creatorIntent:{ageRange:{minimum:12,maximum:6}}}));
 assert.equal("safetyStatus" in parseOperation("quiz_create",{...quiz,safetyStatus:"APPROVED"}),false);
 assert.equal("categories" in parseOperation("quiz_create",{...quiz,categories:["animals"]}),false);
});
test("topic normalization and spoiler guard",()=>{
 const topics=normalizeTopicInputs(quiz.topics,quiz.answer);
 assert.deepEqual(topics.map(t=>t.key),["한국사","세종대왕","history"]);
 assert.equal(topics[1].isSpoiler,true);
 assert.equal(topics[0].isSpoiler,false);
 assert.equal(normalizeTopicKey(" Ｋ-ＰＯＰ "),"k-pop");
 assert.equal(normalizeTopicInputs([{name:"Sejong",isSpoiler:false}],quiz.answer)[0].isSpoiler,true);
});
test("REST/MCP share topic discovery and lookup filters",()=>{
 assert.equal(parseOperation("topic_list",{q:" 역사 "}).q,"역사");
 assert.equal(parseOperation("quiz_list",{topic:"한국사",answerType:"person"}).answerType,"person");
 assert.throws(()=>parseOperation("quiz_list",{answerType:"political"}));
 assert.equal("kidsEligible" in parseOperation("quiz_update",{id,expectedVersion:1}),false);
 const code=readFileSync(new URL("../src/modules/platform/topics.ts",import.meta.url),"utf8");
 assert.match(code,/isSpoiler:false/);
 assert.match(code,/publication:"PUBLISHED"/);
});
