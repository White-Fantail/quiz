import test from "node:test";
import assert from "node:assert/strict";
import {selectPlayablePackItems} from "../src/modules/platform/pack-policy.ts";

const original=[{quizId:"a",position:1},{quizId:"b",position:2},{quizId:"c",position:3}];

test("General pack omits restricted members without deleting or reordering originals",()=>{
  const visible=selectPlayablePackItems(original,new Set(["a","c"]),"GENERAL");
  assert.deepEqual(visible.map(item=>item.quizId),["a","c"]);
  assert.deepEqual(original.map(item=>item.quizId),["a","b","c"]);
  assert.equal(visible[1].position,3);
});
test("General pack remains available with one playable member",()=>{
  assert.deepEqual(selectPlayablePackItems(original,new Set(["c"]),"GENERAL").map(x=>x.quizId),["c"]);
});
test("General pack has no playable members when all are withdrawn",()=>{
  assert.deepEqual(selectPlayablePackItems(original,new Set(),"GENERAL"),[]);
});
test("Kids pack fails closed on any missing/unapproved member",()=>{
  assert.deepEqual(selectPlayablePackItems(original,new Set(["a","c"]),"KIDS"),[]);
});
test("Kids pack passes only when every original member is approved",()=>{
  assert.deepEqual(selectPlayablePackItems(original,new Set(["a","b","c"]),"KIDS"),original);
});
