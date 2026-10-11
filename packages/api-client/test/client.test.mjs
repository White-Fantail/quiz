import test from "node:test";
import assert from "node:assert/strict";
import { normalizeApiOrigin, QuizDipPublicApi, ApiError } from "../src/index.ts";
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
