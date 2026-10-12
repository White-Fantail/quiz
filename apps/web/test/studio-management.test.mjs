import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { operations, parseOperation } from "../src/modules/platform/contracts.ts";

const id="94f0792a-18e6-40c0-a480-0be6d46dbb37";

test("studio owner listing uses validated server pagination and filters",()=>{
  assert.deepEqual(parseOperation("my_quizzes",{}),{
    limit:20,offset:0,search:"",publication:"all",safety:"all",sort:"newest"
  });
  assert.deepEqual(parseOperation("my_quizzes",{
    limit:20,offset:40,search:"  Auckland  ",publication:"PUBLISHED",
    safety:"ACTIVE",sort:"oldest"
  }),{limit:20,offset:40,search:"Auckland",publication:"PUBLISHED",safety:"ACTIVE",sort:"oldest"});
  for(const p of [{limit:101},{offset:-1},{search:"x".repeat(121)},
    {safety:"KIDS_APPROVED"},{sort:"score"},{publication:"UNKNOWN"}]){
    assert.equal(operations.my_quizzes.schema.safeParse(p).success,false);
  }
  assert.equal(operations.my_quizzes.public,false);
});

test("private insights paginates reviews and never accepts a user-supplied owner",()=>{
  assert.deepEqual(parseOperation("my_quiz_insights",{quizId:id}),{
    quizId:id,locale:"all",limit:20,offset:0
  });
  assert.equal(operations.my_quiz_insights.public,false);
  assert.equal("authorId" in parseOperation("my_quiz_insights",{quizId:id,authorId:"spoofed"}),false);
  const src=readFileSync(new URL("../src/modules/platform/studio.ts",import.meta.url),"utf8");
  assert.match(src,/authorId:\s*owner\.id/);
  assert.match(src,/id:true,rating:true,comment:true,locale:true,revisionId:true,createdAt:true/);
  assert.match(src,/db\(\)\.report\.groupBy/);
  assert.doesNotMatch(src,/reporterId: true|reporter: \{/);
});

test("Studio route uses shared REST operations, API/MCP parity and creator safety boundaries",()=>{
  const route=readFileSync(new URL("../app/api/v1/[...segments]/route.ts",import.meta.url),"utf8");
  assert.match(route,/op: "my_quizzes"/);
  assert.match(route,/op: "my_quiz_insights"/);
  const detail=readFileSync(new URL("../app/\(creator\)/studio/quizzes/\[quizId\]/quiz-detail.tsx",import.meta.url),"utf8");
  assert.match(detail,/expectedVersion:quiz\.version/);
  assert.match(detail,/quiz\.publication==="PUBLISHED"&&!window\.confirm/);
  assert.match(detail,/\/me\/quizzes\//);
  assert.doesNotMatch(detail,/kidsEligible:.*(true|false).*PATCH/);
  assert.doesNotMatch(detail,/safetyStatus:.*PATCH/);
  const list=readFileSync(new URL("../app/\(creator\)/studio/studio-workspace.tsx",import.meta.url),"utf8");
  assert.match(list,/PAGE_SIZE = 20/);
  assert.match(list,/page\*PAGE_SIZE/);
  assert.match(list,/AbortController/);
});
