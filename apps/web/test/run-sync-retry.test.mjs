import test from "node:test";
import assert from "node:assert/strict";
import {
  RunSyncBusyError, RUN_SYNC_MAX_ATTEMPTS, isRetryableSyncConflict, withSerializableWriteRetry
} from "../src/modules/platform/run-sync-retry.ts";

test("serialization conflicts retry the whole operation with bounded exponential jitter",async()=>{
  let calls=0;
  const waits=[];
  const result=await withSerializableWriteRetry(async()=>{
    calls++;
    if(calls<4)throw {code:"P2034"};
    return "saved";
  },{sleep:async ms=>{waits.push(ms);},random:()=>0});
  assert.equal(result,"saved");
  assert.equal(calls,4);
  assert.deepEqual(waits,[50,100,200]);
});

test("duplicate-session race is retried; unrelated exceptions are not",async()=>{
  let calls=0;
  await withSerializableWriteRetry(async()=>{
    if(++calls===1)throw {code:"P2002"};
  },{sleep:async()=>{},random:()=>0});
  assert.equal(calls,2);
  assert.equal(isRetryableSyncConflict({code:"P2002"}),true);
  assert.equal(isRetryableSyncConflict({code:"P2034"}),true);
  assert.equal(isRetryableSyncConflict({code:"P2025"}),false);
  calls=0;
  await assert.rejects(withSerializableWriteRetry(async()=>{
    calls++;
    throw new Error("invalid");
  },{sleep:async()=>{}}),/invalid/);
  assert.equal(calls,1);
});

test("exhausted conflicts return a typed busy error with no extra transaction attempt",async()=>{
  let calls=0;
  const retryEvents=[];
  await assert.rejects(withSerializableWriteRetry(async()=>{
    calls++;throw {code:"P2034"};
  },{sleep:async()=>{},random:()=>0,onRetry:(code,attempt,waitMs)=>retryEvents.push({code,attempt,waitMs})}),
  error=>error instanceof RunSyncBusyError&&error.code==="run_sync_busy"&&error.lastConflictCode==="P2034");
  assert.equal(calls,RUN_SYNC_MAX_ATTEMPTS);
  assert.deepEqual(retryEvents.map(e=>e.waitMs),[50,100,200,400]);
});
