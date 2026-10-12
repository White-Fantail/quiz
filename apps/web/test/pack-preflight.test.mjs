import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {operations,parseOperation} from "../src/modules/platform/contracts.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const id="94f0792a-18e6-40c0-a480-0be6d46dbb37";
test("pack readiness is an authenticated, validated, read-only REST/MCP operation",()=>{
 assert.equal(operations.pack_preflight.public,false);
 assert.equal(parseOperation("pack_preflight",{id}).id,id);
 assert.throws(()=>parseOperation("pack_preflight",{id:"invalid"}));
 assert.match(read("app/api/v1/[...segments]/route.ts"),/op:"pack_preflight"/);
 assert.match(read("src/modules/platform/operations.ts"),/case "pack_preflight": return packPreflight/);
 assert.match(read("src/modules/platform/social.ts"),/authorId:user.id/);
 assert.match(read("src/modules/platform/social.ts"),/ready:issues.length===0/);
});
