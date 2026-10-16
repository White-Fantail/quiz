import test from "node:test";
import assert from "node:assert/strict";
import {cachedCompletedResults,cachedRunIds,getCachedRun,storeCachedRun,
  syncCachedRun,recoverCachedRuns} from "../src/lib/local-run-sync.ts";

const runId="cc4477cc-4444-4444-8444-444444444444";
const token="t".repeat(60);
let originals={};
function setup(){
  originals={storage:globalThis.localStorage,fetch:globalThis.fetch,navigator:globalThis.navigator};
  const m=new Map();
  globalThis.localStorage={
    getItem:key=>m.get(key)??null,setItem:(key,val)=>m.set(key,String(val)),
    removeItem:key=>m.delete(key),key:index=>[...m.keys()][index]??null,
    get length(){return m.size;}
  };
  Object.defineProperty(globalThis,"navigator",{value:undefined,configurable:true});
  return m;
}
function restore(){
  if(originals.storage===undefined)delete globalThis.localStorage;
  else globalThis.localStorage=originals.storage;
  globalThis.fetch=originals.fetch;
  Object.defineProperty(globalThis,"navigator",{value:originals.navigator,configurable:true});
}
function cache(progress,synced=false){
  return {bundle:{runId,questions:[{position:0},{position:1}]},
    progress,runToken:token,synced};
}
const first={0:{clueIndex:1,wrongGuesses:0,status:"SOLVED",score:100,mustReveal:false}};
const both={...first,1:{clueIndex:2,wrongGuesses:1,status:"FAILED",score:0,mustReveal:false}};
function response(receipt,ok=true){return {ok,json:async()=>ok?{data:receipt}:{error:"temporary",message:"Try again"}};}

test("legacy synced cache is reconciled without erasing any local round",async()=>{
  const m=setup();
  try{
    storeCachedRun(cache(both,true));
    let calls=0;
    globalThis.fetch=async(_url,init)=>{
      calls++;
      const p=JSON.parse(init.body);
      assert.equal(p.results.length,2);
      return response({runId,completed:2,solved:1,failed:1,score:100,status:"FINISHED"});
    };
    const result=await recoverCachedRuns();
    assert.equal(result.recovered,1);
    assert.equal(result.failed,0);
    assert.equal(calls,1);
    assert.equal(getCachedRun(runId).synced,true);
    assert.deepEqual(cachedCompletedResults(getCachedRun(runId)).map(r=>r.position),[0,1]);
    assert.equal(cachedRunIds().length,1);
    assert.equal(m.size,1);
  }finally{restore();}
});

test("progress added during an in-flight save is resent before cache is acknowledged",async()=>{
  setup();
  try{
    storeCachedRun(cache(first));
    let calls=0;
    globalThis.fetch=async(_url,init)=>{
      calls++;
      const list=JSON.parse(init.body).results;
      if(calls===1) {
        storeCachedRun(cache(both));
        return response({runId,completed:1,solved:1,failed:0,score:100,status:"ACTIVE"});
      }
      assert.equal(list.length,2);
      return response({runId,completed:2,solved:1,failed:1,score:100,status:"FINISHED"});
    };
    const receipt=await syncCachedRun(runId);
    assert.equal(receipt.status,"FINISHED");
    assert.equal(calls,2);
    assert.equal(getCachedRun(runId).synced,true);
    assert.equal(cachedCompletedResults(getCachedRun(runId)).length,2);
  }finally{restore();}
});

test("a failed sync retains unsent progress and a subsequent attempt can recover",async()=>{
  setup();
  try{
    storeCachedRun(cache(both));
    globalThis.fetch=async()=>response(null,false);
    await assert.rejects(syncCachedRun(runId),/Try again/);
    assert.equal(getCachedRun(runId).synced,false);
    globalThis.fetch=async()=>response({runId,completed:2,solved:1,failed:1,score:100,status:"FINISHED"});
    await syncCachedRun(runId);
    assert.equal(getCachedRun(runId).synced,true);
  }finally{restore();}
});

test("parallel calls for the same run share one request and require a server acknowledgement",async()=>{
  setup();
  try{
    storeCachedRun(cache(first));
    let calls=0;
    globalThis.fetch=async()=>{
      calls++;
      await Promise.resolve();
      return response({runId,completed:1,solved:1,failed:0,score:100,status:"ACTIVE"});
    };
    const [a,b]=await Promise.all([syncCachedRun(runId),syncCachedRun(runId)]);
    assert.equal(a.completed,1);assert.equal(b.completed,1);
    assert.equal(calls,1);
    storeCachedRun(cache(both));
    globalThis.fetch=async()=>response({runId,completed:1,solved:1,failed:0,score:100,status:"ACTIVE"});
    await assert.rejects(syncCachedRun(runId),/Server did not confirm/);
    assert.equal(getCachedRun(runId).synced,false);
  }finally{restore();}
});

test("temporary HTTP 503 conflicts are retried and the final acknowledgement saves the cache",async()=>{
  setup();
  try{
    storeCachedRun(cache(both));
    let calls=0;
    globalThis.fetch=async()=>{
      calls++;
      if(calls<3)return {ok:false,status:503,json:async()=>({error:"run_sync_busy",message:"Busy"})};
      return response({runId,completed:2,solved:1,failed:1,score:100,status:"FINISHED"});
    };
    const result=await syncCachedRun(runId);
    assert.equal(result.status,"FINISHED");
    assert.equal(calls,3);
    assert.equal(getCachedRun(runId).synced,true);
  }finally{restore();}
});

test("transient network rejection retries, and permanent 400 fails without replaying",async()=>{
  setup();
  try{
    storeCachedRun(cache(first));
    let calls=0;
    globalThis.fetch=async()=>{
      calls++;
      if(calls===1)throw new Error("connection dropped");
      return response({runId,completed:1,solved:1,failed:0,score:100,status:"ACTIVE"});
    };
    await syncCachedRun(runId);
    assert.equal(calls,2);
    storeCachedRun(cache(both));
    calls=0;
    globalThis.fetch=async()=>{
      calls++;
      return {ok:false,status:400,json:async()=>({message:"Invalid round"})};
    };
    await assert.rejects(syncCachedRun(runId),/Invalid round/);
    assert.equal(calls,1);
    assert.equal(getCachedRun(runId).synced,false);
  }finally{restore();}
});

test("exhausted temporary errors leave full local progress available for later recovery",async()=>{
  setup();
  try{
    storeCachedRun(cache(both));
    let calls=0;
    globalThis.fetch=async()=>{
      calls++;
      return {ok:false,status:503,json:async()=>({message:"Still busy"})};
    };
    await assert.rejects(syncCachedRun(runId),/Still busy/);
    assert.equal(calls,3);
    assert.equal(getCachedRun(runId).synced,false);
    assert.equal(cachedCompletedResults(getCachedRun(runId)).length,2);
  }finally{restore();}
});
