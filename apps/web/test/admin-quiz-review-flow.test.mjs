import test from "node:test";
import assert from "node:assert/strict";
import {parseOperation,operations} from "../src/modules/platform/contracts.ts";

const id="11111111-1111-4111-8111-111111111111";
const base={id,confirm:true};

test("quiz approval accepts a missing or blank explanation while restriction requires one",()=>{
  const yes=parseOperation("quiz_review",{...base,verdict:"APPROVED",kidsEligible:true});
  assert.equal(yes.reason,"");
  assert.equal(parseOperation("quiz_review",{...base,verdict:"APPROVED",reason:"  "}).reason,"");
  assert.throws(()=>parseOperation("quiz_review",{...base,verdict:"RESTRICTED"}));
  assert.throws(()=>parseOperation("quiz_review",{...base,verdict:"RESTRICTED",reason:"four"}));
  assert.equal(parseOperation("quiz_review",{...base,verdict:"RESTRICTED",reason:" unsafe "}).reason,"unsafe");
});
test("media approval accepts no explanation; restriction still needs five characters",()=>{
  assert.equal(parseOperation("media_review",{...base,verdict:"APPROVED"}).reason,"");
  assert.throws(()=>parseOperation("media_review",{...base,verdict:"RESTRICTED"}));
  assert.throws(()=>parseOperation("media_review",{...base,verdict:"RESTRICTED",reason:"bad"}));
  assert.equal(parseOperation("media_review",{...base,verdict:"RESTRICTED",reason:"rights issue"}).verdict,"RESTRICTED");
});
test("pack approval and pending are note-free; restriction needs eight characters",()=>{
  const review={...base,expectedVersion:1};
  assert.equal(parseOperation("admin_pack_safety_review",{...review,verdict:"APPROVED"}).reason,"");
  assert.equal(parseOperation("admin_pack_safety_review",{...review,verdict:"PENDING"}).reason,"");
  assert.throws(()=>parseOperation("admin_pack_safety_review",{...review,verdict:"RESTRICTED",reason:"short"}));
  assert.equal(parseOperation("admin_pack_safety_review",{...review,verdict:"RESTRICTED",reason:"Safety concern"}).verdict,"RESTRICTED");
});
test("moderation queue cannot be exposed as a public operation and bounds pagination",()=>{
  assert.equal(operations.admin_quiz_review_list.public,false);
  assert.equal(parseOperation("admin_quiz_review_list",{}).safety,"PENDING");
  assert.throws(()=>parseOperation("admin_quiz_review_list",{offset:-1}));
  assert.throws(()=>parseOperation("admin_quiz_review_list",{limit:101}));
});
