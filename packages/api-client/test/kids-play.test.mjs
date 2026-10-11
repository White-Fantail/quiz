import test from "node:test";
import assert from "node:assert/strict";
import { QuizDipKidsDeviceApi,ApiError } from "../src/index.ts";

const TOKEN="x".repeat(43);
function client(data,verify){
  return new QuizDipKidsDeviceApi("https://quizdip.example",async(url,options)=>{
    verify(String(url),options);
    return new Response(JSON.stringify({data}),{status:200,headers:{"content-type":"application/json"}});
  });
}
test("starting a five-question Kids run never sends general lane or adult cookies",async()=>{
 const api=client({runId:"abc",runToken:"r".repeat(43),mode:"RANDOM_FIVE",lane:"KIDS",locale:"en"},(url,opts)=>{
   assert.equal(url,"https://quizdip.example/api/kids/native/play");
   assert.equal(opts.credentials,"omit");
   assert.equal(opts.headers.Authorization,"Bearer "+TOKEN);
   const body=JSON.parse(opts.body);
   assert.deepEqual(body,{action:"run_start",mode:"RANDOM_FIVE",avoidQuizIds:[]});
 });
 await api.startRun(TOKEN,"RANDOM_FIVE");
});
test("a child's answer is submitted through the guarded game route",async()=>{
 const api=client({status:"SOLVED",correct:true,score:100,cluesUsed:1},(url,opts)=>{
    const body=JSON.parse(opts.body);
    assert.equal(body.action,"guess");
    assert.equal(body.guess,"Dolphin");
    assert.equal(body.sessionToken,"s".repeat(43));
    assert.equal(url,"https://quizdip.example/api/kids/native/play");
 });
 const answer=await api.guess(TOKEN,"123e4567-e89b-12d3-a456-426614174000","s".repeat(43),"Dolphin");
 assert.equal(answer.correct,true);
});
test("a media URL must use HTTPS and an approved kind",async()=>{
 const bad=client({mediaId:"id",url:"javascript:alert(1)",kind:"image"},()=>{});
 await assert.rejects(bad.playMedia(TOKEN,"id","s".repeat(43),"media"),ApiError);
 const good=client({mediaId:"id",url:"https://r2.example.com/signed",kind:"audio",expiresInSeconds:60,mimeType:"audio/mpeg"},()=>{});
 const approved=await good.playMedia(TOKEN,"id","s".repeat(43),"media");
 assert.equal(approved.kind,"audio");
});
test("treasures read is always scoped to child bearer without browser cookies",async()=>{
 const api=client({solved:1,completed:2,badges:[],discoveries:[]},(url,opts)=>{
   assert.match(url,/view=treasures/);
   assert.equal(opts.method,"GET");
   assert.equal(opts.credentials,"omit");
   assert.equal(opts.headers.Authorization,"Bearer "+TOKEN);
 });
 const data=await api.treasures(TOKEN);
 assert.equal(data.solved,1);
});
