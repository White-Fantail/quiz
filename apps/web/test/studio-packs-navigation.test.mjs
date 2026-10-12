import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseOperation,operations} from "../src/modules/platform/contracts.ts";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("packs management has separate browse/create/edit routes with direct links",()=>{
  const list=read("app/(creator)/studio/packs/pack-workspace.tsx");
  const create=read("app/(creator)/studio/packs/new/page.tsx");
  const edit=read("app/(creator)/studio/packs/[packId]/page.tsx");
  const editor=read("app/(creator)/studio/packs/pack-editor.tsx");
  assert.match(list,/\/studio\/packs\/new/);
  assert.match(list,/\/studio\/packs\/"\+pack\.id/);
  assert.doesNotMatch(list,/onClick=\{\(\)=>choose/);
  assert.match(create,/<PackEditor\/>/);
  assert.match(edit,/<PackEditor packId=\{packId\}\/>/);
  assert.match(editor,/\/me\/packs\/"\+packId/);
  assert.match(editor,/router\.replace/);
  assert.match(editor,/dirty\|\|!preview\?\.ready/);
});
test("owner pack detail is private and fetched by ID without listing limit",()=>{
  const id="94f0792a-18e6-40c0-a480-0be6d46dbb37";
  assert.equal(operations.my_pack_get.public,false);
  assert.deepEqual(parseOperation("my_pack_get",{id}),{id});
  const route=read("app/api/v1/[...segments]/route.ts");
  assert.match(route,/op:"my_pack_get"/);
  const social=read("src/modules/platform/social.ts");
  assert.match(social,/export async function myPackGet/);
  assert.match(social,/where:\{id:p\.id,authorId:owner\.id\}/);
  assert.match(social,/pack\.items\.map\(item=>item\.quizId\)/);
  assert.match(social,/db\(\)\.quizPack\.count\(\{where\}\)/);
  const list=read("app/(creator)/studio/packs/pack-workspace.tsx");
  assert.match(list,/PAGE_SIZE=20/);
  assert.match(list,/AbortController/);
  assert.match(list,/total>PAGE_SIZE/);
});
