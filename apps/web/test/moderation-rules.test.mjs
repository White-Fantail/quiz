import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_REPORT_HOLD_POLICY as DEFAULT, shouldAutoHold } from "../src/modules/platform/moderation-rules.ts";

test("general reports never hold before the configurable distinct reporter threshold",()=>{
  assert.equal(shouldAutoHold(DEFAULT,"QUIZ",1,1),false);
  assert.equal(shouldAutoHold(DEFAULT,"QUIZ",2,2),false);
  assert.equal(shouldAutoHold(DEFAULT,"QUIZ",3,1),false);
  assert.equal(shouldAutoHold(DEFAULT,"QUIZ",3,2),true);
});
test("pack and quiz thresholds can be changed independently without redeploying",()=>{
  const rules={...DEFAULT,quizReportThreshold:5,packReportThreshold:2,minimumEstablishedReporters:1};
  assert.equal(shouldAutoHold(rules,"QUIZ",4,2),false);
  assert.equal(shouldAutoHold(rules,"QUIZ",5,2),true);
  assert.equal(shouldAutoHold(rules,"PACK",2,1),true);
});
test("disabled auto holds never withhold content regardless of reports",()=>{
  assert.equal(shouldAutoHold({...DEFAULT,enabled:false},"QUIZ",99,99),false);
  assert.equal(shouldAutoHold({...DEFAULT,enabled:false},"PACK",99,99),false);
});
