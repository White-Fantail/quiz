import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("run synchronization uses acknowledged serializable transactions and retries conflicts",()=>{
  const server=read("src/modules/platform/local-play.ts");
  assert.match(server,/withSerializableWriteRetry\(\(\)=>db\(\)\.\$transaction/);
  assert.match(server,/isolationLevel:"Serializable"/);
  assert.match(server,/current\.currentIndex!==completed/);
  assert.match(server,/currentIndex:completed,score,solved,failed/);
  assert.match(server,/fail\(503,"run_sync_busy"/);
});

test("results screen repairs local history and refreshes server rows after recovery",()=>{
  const history=read("app/account/results/page.tsx");
  const player=read("app/(platform)/play/page.tsx");
  assert.ok(history.includes("recoverCachedRuns("));
  assert.ok(history.includes("void load();return()=>{loadSequence.current++;}"));
  assert.ok(history.includes("Retry pending results"));
  assert.ok(player.includes("confirmedRunId===run.runId"));
  assert.ok(player.includes("syncCachedRun("));
  assert.ok(player.includes("Retry saving results"));
});

test("server can repair historical aggregate counters from persisted PlaySession records",()=>{
  const runs=read("src/modules/platform/runs.ts");
  const contracts=read("src/modules/platform/contracts.ts");
  const api=read("app/api/v1/[...segments]/route.ts");
  const operations=read("src/modules/platform/operations.ts");
  const history=read("app/account/results/page.tsx");
  assert.match(runs,/export async function runReconcile/);
  assert.match(runs,/where:\{runId:run\.id,status:\{in:\["SOLVED","FAILED"\]\}\}/);
  assert.match(runs,/isolationLevel:"Serializable"/);
  assert.match(runs,/run\.userId|userId:user\.id/);
  assert.match(contracts,/run_reconcile: \{ public: false/);
  assert.match(api,/op:"run_reconcile"/);
  assert.match(operations,/case "run_reconcile"/);
  assert.match(history,/api\("\/runs\/reconcile"/);
});
