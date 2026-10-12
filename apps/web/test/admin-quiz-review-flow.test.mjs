import test from "node:test";
import assert from "node:assert/strict";
import {parseOperation,operations} from "../src/modules/platform/contracts.ts";

const id="11111111-1111-4111-8111-111111111111";
const base={id,confirm:true};

test("general approval and adult pending no longer exist",()=>{
  assert.throws(()=>parseOperation("quiz_review",{...base,verdict:"APPROVED"}));
  assert.throws(()=>parseOperation("quiz_review",{...base,verdict:"PENDING"}));
  assert.equal(parseOperation("quiz_review",{...base,verdict:"CLEARED"}).reason,"");
  assert.equal(parseOperation("quiz_review",{...base,verdict:"RESTORED"}).reason,"");
  assert.equal(parseOperation("quiz_review",{...base,verdict:"KIDS_APPROVED"}).reason,"");
  assert.throws(()=>parseOperation("quiz_review",{...base,verdict:"RESTRICTED"}));
  assert.throws(()=>parseOperation("quiz_review",{...base,verdict:"RESTRICTED",reason:"four"}));
  assert.throws(()=>parseOperation("quiz_review",{...base,verdict:"KIDS_REJECTED",reason:"four"}));
  assert.equal(parseOperation("quiz_review",{...base,verdict:"KIDS_REJECTED",reason:"not age appropriate"}).verdict,"KIDS_REJECTED");
});
test("a creator can request or withdraw Kids review but cannot set approval",()=>{
  assert.equal(parseOperation("quiz_kids_request",{id,requested:true}).requested,true);
  assert.equal(parseOperation("quiz_kids_request",{id,requested:false}).requested,false);
  assert.throws(()=>parseOperation("quiz_kids_request",{id,requested:"APPROVED"}));
  assert.equal(operations.quiz_kids_request.public,false);
  assert.equal("kidsReviewStatus" in operations.quiz_create.schema.shape,false);
  assert.equal(parseOperation("quiz_create",{
    title:"Dolphin",prompt:"Who am I?",answer:{canonical:"Dolphin",aliases:[]},
    clues:[{type:"text",text:"I swim"}],kidsRequested:true
  }).kidsRequested,true);
});
test("media approval is still separate and restriction needs an explanation",()=>{
  assert.equal(parseOperation("media_review",{...base,verdict:"APPROVED"}).reason,"");
  assert.throws(()=>parseOperation("media_review",{...base,verdict:"RESTRICTED"}));
  assert.equal(parseOperation("media_review",{...base,verdict:"RESTRICTED",reason:"rights issue"}).verdict,"RESTRICTED");
});
test("pack review retains its independent Kids pending state",()=>{
  const review={...base,expectedVersion:1};
  assert.equal(parseOperation("admin_pack_safety_review",{...review,verdict:"APPROVED"}).reason,"");
  assert.equal(parseOperation("admin_pack_safety_review",{...review,verdict:"PENDING"}).reason,"");
  assert.throws(()=>parseOperation("admin_pack_safety_review",{...review,verdict:"RESTRICTED",reason:"short"}));
});
test("moderation queues are admin-only with bounded pagination",()=>{
  assert.equal(operations.admin_quiz_review_list.public,false);
  assert.equal(parseOperation("admin_quiz_review_list",{}).queue,"ATTENTION");
  for(const queue of ["REPORTS","RATINGS","KIDS","RESTRICTED","ALL"])
    assert.equal(parseOperation("admin_quiz_review_list",{queue}).queue,queue);
  assert.throws(()=>parseOperation("admin_quiz_review_list",{queue:"PENDING"}));
  assert.throws(()=>parseOperation("admin_quiz_review_list",{offset:-1}));
  assert.throws(()=>parseOperation("admin_quiz_review_list",{limit:101}));
});
