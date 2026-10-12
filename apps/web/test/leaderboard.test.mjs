import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  periodBounds, rankCandidates, difficultQuizzes, personalSummary
} from "../src/modules/platform/leaderboard-rules.ts";
import {operations, parseOperation} from "../src/modules/platform/contracts.ts";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const now=new Date("2026-10-13T08:00:00.000Z");
const users=[
  {userId:"alice",displayName:"Alice",createdAt:new Date("2025-01-01T00:00:00Z")},
  {userId:"bob",displayName:"Bob",createdAt:new Date("2026-10-01T00:00:00Z")}
];
const attempt=(userId,quizId,status="SOLVED",score=100,extras={})=>({
  userId,quizId,status,score,usedClues:1,clueCount:4,
  authorId:"other",topicId:"topic-one",finishedAt:new Date("2026-10-13T07:00:00Z"),...extras
});

test("UTC period bounds use inclusive day, Monday week and first-of-month",()=>{
  assert.equal(periodBounds("day",now).start.toISOString(),"2026-10-13T00:00:00.000Z");
  assert.equal(periodBounds("week",now).start.toISOString(),"2026-10-12T00:00:00.000Z");
  assert.equal(periodBounds("month",now).start.toISOString(),"2026-10-01T00:00:00.000Z");
  assert.equal(periodBounds("all",now).start,null);
  assert.equal(periodBounds("week",new Date("2026-10-18T12:00:00Z")).start.toISOString(),"2026-10-12T00:00:00.000Z");
});

test("first completion per user and quiz is final for the period, with self-play excluded",()=>{
  const rows=[
    attempt("alice","q1","FAILED",0,{finishedAt:new Date("2026-10-13T06:00:00Z")}),
    attempt("alice","q1","SOLVED",100),
    attempt("alice","q2","SOLVED",80),
    attempt("alice","self","SOLVED",100,{authorId:"alice"}),
    attempt("bob","q1","SOLVED",70)
  ];
  const result=rankCandidates(users,rows,"solved",new Map(),now);
  assert.equal(result.find(r=>r.userId==="alice").solved,1);
  assert.equal(result.find(r=>r.userId==="alice").finished,2);
  assert.equal(result.find(r=>r.userId==="alice").failed,1);
  assert.equal(result.find(r=>r.userId==="alice").score,80);
});

test("detective requires five successfully solved multi-clue questions",()=>{
  const rows=Array.from({length:5},(_,i)=>attempt("bob","multi"+i,"SOLVED",90));
  assert.equal(rankCandidates(users,rows,"detective",new Map(),now)[0].value,90);
  assert.deepEqual(rankCandidates(users,rows.slice(0,4),"detective",new Map(),now),[]);
  assert.deepEqual(rankCandidates(users,rows.map(r=>({...r,clueCount:1})),"detective",new Map(),now),[]);
});

test("explorer counts independently solved topic clusters, not many topic tags per question",()=>{
  const rows=[
    attempt("alice","a","SOLVED",100,{topicId:"history"}),
    attempt("alice","b","SOLVED",100,{topicId:"history"}),
    attempt("alice","c","SOLVED",100,{topicId:"science"}),
    attempt("alice","d","SOLVED",100,{topicId:"science"}),
    attempt("alice","e","SOLVED",100,{topicId:"rare"})
  ];
  assert.equal(rankCandidates(users,rows,"explorer",new Map(),now)[0].value,2);
});

test("difficult questions need ten independent completed accounts and 40% first-time failures",()=>{
  const rows=Array.from({length:10},(_,i)=>
    attempt("test"+i,"difficult",i<4?"FAILED":"SOLVED",i<4?0:50));
  const difficulty=difficultQuizzes(rows);
  assert.equal(difficulty.get("difficult"),40);
  assert.equal(difficultQuizzes(rows.slice(0,9)).size,0);
  assert.equal(difficultQuizzes(rows.map((r,i)=>({...r,status:i<3?"FAILED":"SOLVED"}))).size,0);
  assert.equal(rankCandidates([{userId:"test4",displayName:"Hero",createdAt:new Date(0)}],rows,"challenge",difficulty,now)[0].value,20);
});

test("rising star only includes accounts created in the past 30 days",()=>{
  const rows=[attempt("alice","a"),attempt("bob","b")];
  const result=rankCandidates(users,rows,"rising",new Map(),now);
  assert.deepEqual(result.map(r=>r.userId),["bob"]);
});

test("private stats exclude authored questions and remain meaningful without opt-in",()=>{
  const report=personalSummary([attempt("alice","own","SOLVED",100,{authorId:"alice"}),attempt("alice","q","SOLVED",75)]);
  assert.equal(report.solved,1);
  assert.equal(report.score,75);
});

test("new ranking filters are validated identically for REST and MCP and remain adult-only",()=>{
  assert.equal(parseOperation("leaderboard",{period:"week",category:"explorer"}).period,"week");
  assert.equal(parseOperation("leaderboard",{}).period,"all");
  assert.throws(()=>parseOperation("leaderboard",{period:"year"}));
  assert.throws(()=>parseOperation("leaderboard",{category:"kids"}));
  assert.equal(operations.my_stats.public,false);
  assert.equal(operations.leaderboard.public,true);
  const rest=read("app/api/v1/[...segments]/route.ts");
  const mcp=read("app/api/mcp/route.ts");
  assert.match(rest,/op: "leaderboard"/);
  assert.match(rest,/op: "my_stats"/);
  assert.match(mcp,/Object.keys\(operations\)/);
  const service=read("src/modules/platform/leaderboard-service.ts");
  assert.match(service,/leaderboardEligible:true,leaderboardOptIn:true/);
  assert.match(service,/kidSingle:\{is:null\}/);
  assert.match(service,/lane:"GENERAL"/);
  assert.match(service,/ranking_over_capacity/);
});

test("homepage features winners, account shows private records, no weekly challenge or Kids rankings",()=>{
  const home=read("app/(platform)/page.tsx");
  const account=read("app/account/page.tsx");
  assert.match(home,/<LeaderboardSpotlight/);
  assert.match(account,/<MyStatsPanel/);
  assert.doesNotMatch(home,/home\.weekly/);
  assert.match(read("app/(platform)/leaderboard/page.tsx"),/useState<Period>\("week"\)/);
  assert.match(read("app/account/account-actions.tsx"),/Public leaderboard visibility/);
});
