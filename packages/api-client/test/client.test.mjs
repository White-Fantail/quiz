import test from "node:test";
import assert from "node:assert/strict";
import { normalizeApiOrigin, QuizDipPublicApi, QuizDipKidsDeviceApi, ApiError } from "../src/index.ts";
test("API URL rejects credentials, unsafe HTTP, and path injection",()=>{
 assert.equal(normalizeApiOrigin("https://quizdip.example/"),"https://quizdip.example");
 assert.throws(()=>normalizeApiOrigin("http://quizdip.example"), /insecure_api_origin/);
 assert.throws(()=>normalizeApiOrigin("https://user:password@quizdip.example"), /invalid_api_origin/);
 assert.throws(()=>normalizeApiOrigin("https://quizdip.example/x"), /invalid_api_origin/);
 assert.equal(normalizeApiOrigin("http://localhost:3000",true),"http://localhost:3000");
});
test("catalog always requests server-approved kids-only locale and filters unsafe results",async()=>{
 let request;
 const api=new QuizDipPublicApi("https://quizdip.example",async (url,options)=>{
  request={url:String(url),options};
  return new Response(JSON.stringify({data:{items:[
   {id:"1",title:"Safe",prompt:"Who?",answerType:"animal",kidsEligible:true},
   {id:"2",title:"Unsafe",prompt:"Who?",answerType:"animal",kidsEligible:false}
  ]}}),{status:200,headers:{"Content-Type":"application/json"}});
 });
 const page=await api.kidsCatalog("ko",{answerType:"animal",limit:8});
 assert.deepEqual(page.items.map(x=>x.id),["1"]);
 assert.match(request.url,/kids=true/);assert.match(request.url,/locale=ko/);
 assert.equal(request.options.credentials,"omit");
 await assert.rejects(api.kidsCatalog("fr"), /invalid_locale/);
});
test("unconfigured result cannot be mistaken for an approved catalog",async()=>{
 const api=new QuizDipPublicApi("https://quizdip.example",async()=>new Response(JSON.stringify({data:{items:null}}),{status:200}));
 await assert.rejects(api.kidsCatalog("en"),ApiError);
});

test("native pairing exchanges a single-use code without sending browser cookies",async()=>{
 let pairRequest;
 const api=new QuizDipKidsDeviceApi("https://quizdip.example",async (url,options)=>{
   pairRequest={url:String(url),options};
   return new Response(JSON.stringify({data:{active:true,token:"a".repeat(43),
     profile:{nickname:"Explorer",ageBand:"EARLY",locale:"ko"},expiresAt:"2026-11-12T01:00:00.000Z"}}),
     {status:200,headers:{"content-type":"application/json"}});
 });
 const paired=await api.pair("ABCDEF-123456-ABCDEF-123456","My iPad");
 assert.equal(paired.profile.locale,"ko");
 assert.equal(pairRequest.url,"https://quizdip.example/api/kids/native");
 assert.equal(pairRequest.options.credentials,"omit");
 assert.equal(pairRequest.options.redirect,"error");
 assert.equal(pairRequest.options.headers.Authorization,undefined);
 assert.match(pairRequest.options.body,/"action":"pair"/);
});
test("native Kids catalog is bearer-scoped and locale-pinned",async()=>{
 let request;
 const api=new QuizDipKidsDeviceApi("https://quizdip.example",async (url,options)=>{
   request={url:String(url),options};
   return new Response(JSON.stringify({data:{items:[
      {id:"1",title:"Safe",prompt:"What?",kidsEligible:true},
      {id:"2",title:"Unsafe",prompt:"No",kidsEligible:false}
   ]}}),{status:200});
 });
 const items=await api.catalog("b".repeat(43),{limit:8}, "en");
 assert.deepEqual(items.items.map(x=>x.id),["1"]);
 assert.match(request.url,/view=catalog/);
 assert.match(request.url,/locale=en/);
 assert.equal(request.options.headers.Authorization,"Bearer "+"b".repeat(43));
 assert.equal(request.options.credentials,"omit");
 assert.equal(request.options.redirect,"error");
});
test("native invalid or revoked credential cannot be treated as connected",async()=>{
 const api=new QuizDipKidsDeviceApi("https://quizdip.example",async()=>new Response(
    JSON.stringify({error:"native_session_invalid"}),{status:401}));
 await assert.rejects(api.session("c".repeat(43)),e=>e instanceof ApiError&&e.status===401);
});
test("native PIN exit sends neither adult cookies nor secrets in URLs",async()=>{
 let request;
 const api=new QuizDipKidsDeviceApi("https://quizdip.example",async(url,opts)=>{
   request={url:String(url),options:opts};
   return new Response(JSON.stringify({data:{unlocked:true}}),{status:200});
 });
 await api.unlock("c".repeat(43),"123456");
 assert.equal(request.options.credentials,"omit");
 assert.equal(request.url,"https://quizdip.example/api/kids/native");
 assert.equal(JSON.parse(request.options.body).pin,"123456");
});
