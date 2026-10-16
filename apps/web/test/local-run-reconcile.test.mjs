import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("run synchronization uses acknowledged serializable transactions and retries conflicts",()=>{
  const server=read("src/modules/platform/local-play.ts");
  assert.match(server,/return await db\(\)\.\$transaction/);
  assert.match(server,/isolationLevel:"Serializable"/);
  assert.match(server,/code==="P2034"/);
  assert.match(server,/code==="P2002"/);
  assert.match(server,/currentIndex:completed,score,solved,failed/);
});

test("results screen repairs local history and refreshes server rows after recovery",()=>{
  const history=read("app/account/results/page.tsx");
  const player=read("app/(platform)/play/page.tsx");
  assert.ok(history.includes("recoverCachedRuns("));
  assert.ok(history.includes("await load()"));
  assert.ok(history.includes("Retry pending results"));
  assert.ok(player.includes("confirmedRunId===run.runId"));
  assert.ok(player.includes("syncCachedRun("));
  assert.ok(player.includes("Retry saving results"));
});
