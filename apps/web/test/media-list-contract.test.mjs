import { test } from "node:test";
import assert from "node:assert/strict";
import { operations } from "../src/modules/platform/contracts.ts";

test("media listing is server-paginated and filters are validated", () => {
  const schema=operations.media_list.schema;
  assert.deepEqual(schema.parse({limit:24,offset:48,search:"  tiger  ",kind:"image",
    moderation:"PENDING",status:"READY",usage:"used",sort:"name"}),{
    limit:24,offset:48,search:"tiger",kind:"image",moderation:"PENDING",
    status:"READY",usage:"used",sort:"name",
  });
  assert.deepEqual(schema.parse({}),{limit:20,offset:0,search:"",kind:"all",
    moderation:"all",status:"all",usage:"all",sort:"newest"});
  assert.equal(schema.safeParse({limit:101}).success,false);
  assert.equal(schema.safeParse({search:"x".repeat(121)}).success,false);
  assert.equal(schema.safeParse({usage:"unknown"}).success,false);
  assert.equal(schema.safeParse({kind:"text"}).success,false);
});

test("thumbnail-only media lookup uses owner-authenticated media_get", () => {
  assert.deepEqual(operations.media_get.schema.parse({id:"00000000-0000-0000-0000-000000000000",purpose:"thumbnail"}),{
    id:"00000000-0000-0000-0000-000000000000",purpose:"thumbnail",
  });
  assert.equal(operations.media_get.public,false);
});
