import test from "node:test";
import assert from "node:assert/strict";
import { LOCALES, resolveLocale, localizeHref } from "../src/core.ts";
import { KIDS_MESSAGES, kidsT } from "../src/kids.ts";
test("Kids catalog is bilingual with matching keys",()=>{
 const en=Object.keys(KIDS_MESSAGES.en).sort(), ko=Object.keys(KIDS_MESSAGES.ko).sort();
 assert.deepEqual(en,ko); assert.ok(en.length>80);
 for(const locale of LOCALES) for(const key of en) assert.ok(KIDS_MESSAGES[locale][key]?.trim(), locale+" "+key);
});
test("native uses web Kids wording and keeps locale strict",()=>{
 assert.equal(kidsT("en","kids.nav.explore"),"Explore");
 assert.equal(kidsT("ko","kids.nav.explore"),"탐험");
 assert.equal(resolveLocale("fr"),"en");
 assert.equal(localizeHref("/kids", "ko"), "/ko/kids");
});
