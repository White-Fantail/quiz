import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const file=path=>readFileSync(join(process.cwd(),path),"utf8");
const overview=file("apps/web/app/admin/moderation/moderation-console.tsx");
const settings=file("apps/web/app/admin/moderation/policy-settings.tsx");
const route=file("apps/web/app/admin/moderation/settings/page.tsx");
const css=file("apps/web/app/globals.css");

test("routine moderation queue links to settings without rendering the threshold editor",()=>{
  assert.match(overview,/\/admin\/moderation\/settings/);
  assert.match(overview,/ModerationDetail/);
  assert.match(overview,/ModeratorAppeals/);
  assert.doesNotMatch(overview,/Save policy|quizReportThreshold.*onChange|<input type="checkbox" checked={policy\.enabled}/);
});
test("settings are restricted to ADMIN and keep shared REST/MCP policy API",()=>{
  assert.match(route,/actorFor/);
  assert.match(route,/actor\.role!=="ADMIN"/);
  assert.match(settings,/\/api\/v1\/admin\/moderation\/policy/);
  assert.match(settings,/confirm:true/);
  assert.match(settings,/method,credentials:"same-origin"/);
});
test("five configurable rules have independent explanations and real hover/focus/click tooltips",()=>{
  const rules=[
    "quizReportThreshold","packReportThreshold","windowHours",
    "minimumEstablishedReporters","establishedAccountDays"
  ];
  for(const field of rules)assert.match(settings,new RegExp(field+":\\s*\\{"));
  assert.match(settings,/aria-describedby={id}/);
  assert.match(settings,/aria-expanded={open}/);
  assert.match(settings,/onClick=\{\(\)=>setOpen\(previous=>!previous\)\}/);
  assert.match(css,/\.moderation-help-badge:is\(:hover,:focus-within,\.is-open\)/);
  assert.match(css,/\.moderation-help-popover/);
});
test("rule explanation defaults collapsed and unsaved changes are signaled",()=>{
  assert.match(settings,/<details className="moderation-policy-explainer">/);
  assert.match(settings,/Unsaved changes · preview only/);
  assert.match(settings,/!valid\|\|!dirty/);
  assert.match(settings,/Existing open reports will be re-evaluated immediately/);
});
