import test from "node:test";
import assert from "node:assert/strict";
import {ageEligible} from "../src/modules/platform/kids-age.ts";

test("a 4–5 quiz overlaps the youngest Kids band (4–7)",()=>{
  const preschool={ageRange:{minimum:4,maximum:5}};
  assert.equal(ageEligible(preschool,"EARLY"),true);
  assert.equal(ageEligible(preschool,"MIDDLE"),false);
  assert.equal(ageEligible(preschool,"OLDER"),false);
});
test("boundaries overlap, while older-only questions are not shown to younger Kids",()=>{
  const boundary={ageRange:{minimum:7,maximum:8}};
  assert.equal(ageEligible(boundary,"EARLY"),true);
  assert.equal(ageEligible(boundary,"MIDDLE"),true);
  assert.equal(ageEligible(boundary,"OLDER"),false);
  const older={ageRange:{minimum:11,maximum:12}};
  assert.equal(ageEligible(older,"EARLY"),false);
  assert.equal(ageEligible(older,"OLDER"),true);
});
test("missing age recommendation is never treated as a safety veto",()=>{
  assert.equal(ageEligible(null,"EARLY"),true);
  assert.equal(ageEligible({},"MIDDLE"),true);
  assert.equal(ageEligible({ageRange:{maximum:5}},"EARLY"),true);
  assert.equal(ageEligible({ageRange:{minimum:9}},"MIDDLE"),true);
  assert.equal(ageEligible({ageRange:{minimum:11}},"EARLY"),false);
  assert.equal(ageEligible({ageRange:{minimum:11}}),true);
});
