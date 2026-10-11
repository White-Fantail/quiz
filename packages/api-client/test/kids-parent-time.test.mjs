import test from "node:test";
import assert from "node:assert/strict";
import { QuizDipKidsDeviceApi,QuizDipKidsParentApi,ApiError } from "../src/index.ts";
const origin="https://quizdip.example",child="c".repeat(43),parent="p".repeat(43);
test("native time heartbeat never sends client clock or browser cookies",async()=>{
 let seen;
 const client=new QuizDipKidsDeviceApi(origin,async(url,opts)=>{
  seen={url,opts};
  return new Response(JSON.stringify({data:{localDay:"2026-10-12",usedMinutes:12,
    remainingMinutes:18,sessionMinutesUsed:12,blockedUntil:null,limitReached:false,
    serverNow:"2026-10-12T01:00:00Z",
    limits:{dailyMinutes:30,playSessionMinutes:20,breakEveryMinutes:15,timeZone:"Pacific/Auckland"}}}),
    {status:200});
 });
 const state=await client.time(child,true);
 assert.equal(state.remainingMinutes,18);
 assert.equal(seen.url,origin+"/api/kids/native/time");
 assert.equal(seen.opts.credentials,"omit");
 assert.equal(seen.opts.headers.Authorization,"Bearer "+child);
 assert.deepEqual(JSON.parse(seen.opts.body),{action:"heartbeat"});
 assert.doesNotMatch(seen.opts.body,/Date|duration|utcMinute/);
});
test("time restrictions are surfaced to the app instead of allowing offline fallback",async()=>{
 const client=new QuizDipKidsDeviceApi(origin,async()=>new Response(
   JSON.stringify({error:"kid_daily_limit"}),{status:429}));
 await assert.rejects(client.time(child,true),(e)=>e instanceof ApiError&&e.code==="kid_daily_limit");
});
test("guardian PIN elevation and dashboard include both child and short parent credential",async()=>{
 const calls=[];
 const api=new QuizDipKidsParentApi(origin,async(url,opts)=>{
   calls.push({url,opts});
   if(opts.method==="POST")return new Response(JSON.stringify({data:{parentToken:parent,expiresAt:"2026-10-12T02:00:00Z"}}),{status:200});
   return new Response(JSON.stringify({data:{pinConfigured:true,profiles:[],devices:[],insights:[],
     serverNow:"2026-10-12T01:00:00Z",availableTimeZones:["Pacific/Auckland"]}}),{status:200});
 });
 await api.authorize(child,"123456");
 const overview=await api.dashboard(child,parent);
 assert.deepEqual(overview.profiles,[]);
 assert.equal(calls[0].opts.credentials,"omit");
 assert.equal(calls[0].opts.headers["X-Kids-Parent"],undefined);
 assert.equal(calls[1].opts.headers["X-Kids-Parent"],"Bearer "+parent);
 assert.equal(calls[1].opts.headers.Authorization,"Bearer "+child);
 assert.equal(calls[1].opts.credentials,"omit");
 assert.ok(calls.every(x=>x.url===origin+"/api/kids/native/parent"));
});
test("guardian operations don't allow parent PIN privilege to upgrade adult REST or MCP",async()=>{
 const api=new QuizDipKidsParentApi(origin,async()=>new Response(JSON.stringify({data:{updated:true}}),{status:200}));
 await assert.rejects(api.action(child,parent,{action:"authorize",pin:"123456"}),ApiError);
});
