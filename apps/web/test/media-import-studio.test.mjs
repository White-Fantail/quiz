import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { operations } from "../src/modules/platform/contracts.ts";

test("image URL import is exposed in Studio and remains REST/MCP shared operation",()=>{
  const studio=readFileSync(new URL("../app/(creator)/studio/media/media-library.tsx",import.meta.url),"utf8");
  const rest=readFileSync(new URL("../app/api/v1/[...segments]/route.ts",import.meta.url),"utf8");
  const dispatcher=readFileSync(new URL("../src/modules/platform/operations.ts",import.meta.url),"utf8");
  assert.match(studio,/request\("\/media\/import","POST"/);
  assert.match(studio,/licence|license/i);
  assert.match(studio,/setImportRights/);
  assert.match(studio,/Wikimedia Commons/);
  assert.match(studio,/Unsplash/);
  assert.match(studio,/Pexels/);
  assert.match(studio,/Pixabay/);
  assert.match(rest,/op: "media_import"/);
  assert.match(dispatcher,/case "media_import"/);
  assert.ok(operations.media_import);
  assert.equal(operations.media_import.public,false);
});

test("image URL import contracts never accept client-controlled trust or safety flags",()=>{
  const schema=operations.media_import.schema;
  const input={
    url:"https://upload.wikimedia.org/wikipedia/commons/0/00/example.jpg",
    kind:"image",filename:"example.jpg",alt:"Clue",attribution:"Photographer / Wikimedia Commons",
    license:"CC BY 4.0",
  };
  assert.equal(schema.parse(input).url,input.url);
  assert.equal(schema.safeParse({...input,url:"file:///etc/passwd"}).success,false);
  assert.equal(schema.safeParse({...input,kind:"script"}).success,false);
  assert.equal(schema.safeParse({...input,filename:"x".repeat(201)}).success,false);
  // Unknown fields are stripped, never authorize a review or unapproved public usage.
  assert.equal(schema.parse({...input,moderationStatus:"APPROVED",kidsEligible:true}).moderationStatus,undefined);
});
