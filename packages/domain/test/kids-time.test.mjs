import test from "node:test";
import assert from "node:assert/strict";
import { localChildDay,utcMinuteSlot } from "../src/kids-time.ts";
test("Auckland and Seoul count one instant in the correct local day",()=>{
 const now=new Date("2026-10-12T10:55:00Z");
 assert.equal(localChildDay(now,"Pacific/Auckland"),"2026-10-12"); // Oct 12 23:55 NZDT
 assert.equal(localChildDay(now,"Asia/Seoul"),"2026-10-12");
 assert.equal(localChildDay(new Date("2026-10-12T12:10:00Z"),"Pacific/Auckland"),"2026-10-13");
});
test("Auckland daylight saving shift is handled by IANA time zone, not local device clocks",()=>{
 assert.equal(localChildDay(new Date("2026-04-04T12:30:00Z"),"Pacific/Auckland"),"2026-04-05");
 assert.equal(localChildDay(new Date("2026-04-05T12:30:00Z"),"Pacific/Auckland"),"2026-04-06");
 assert.equal(localChildDay(new Date("2026-09-26T12:30:00Z"),"Pacific/Auckland"),"2026-09-27");
});
test("UTC minute slot is global across two devices and monotonic across clock boundaries",()=>{
 const a=utcMinuteSlot(new Date("2026-10-12T12:00:00.000Z"));
 assert.equal(a,utcMinuteSlot(new Date("2026-10-12T12:00:59.000Z")));
 assert.equal(a+1,utcMinuteSlot(new Date("2026-10-12T12:01:00.000Z")));
});
