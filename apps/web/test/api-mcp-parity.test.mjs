import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { operations, parseOperation } from "../src/modules/platform/contracts.ts";

test("every REST action is exposed as an MCP operation via the shared registry", () => {
  const names = Object.keys(operations);
  assert.equal(names.length, 57);
  const restSource = readFileSync(new URL("../app/api/v1/[...segments]/route.ts", import.meta.url), "utf8");
  const mcpSource = readFileSync(new URL("../app/api/mcp/route.ts", import.meta.url), "utf8");
  for (const name of names) {
    assert.match(restSource, new RegExp('op: "' + name + '"'), name + " not routed in REST");
  }
  assert.match(mcpSource, /Object\.keys\(operations\)/);
  assert.match(mcpSource, /server\.registerTool\("quizdip_" \+ name/);
  assert.doesNotMatch(mcpSource, /clupio_|Deprecated alias|legacy alias/i);
  assert.match(mcpSource, /execute\(name, args, actor\)/);
});

test("quiz schema requires at least one usable clue and an answer", () => {
  const good = { title: "Animal", prompt: "Who am I?", mode: "progressive-clues", answerType: "animal",
    answer: { canonical: "dolphin", aliases: ["돌고래"] },
    clues: [{ type: "text", text: "I breathe air" }] };
  assert.equal(parseOperation("quiz_create", good).mode, "progressive-clues");
  assert.throws(() => parseOperation("quiz_create", { ...good, clues: [] }));
  assert.throws(() => parseOperation("quiz_create", { ...good, clues: [{ type: "image", media: { url: "https://unsafe.example/image.png" } }] }));
  assert.equal(parseOperation("quiz_create", { ...good, promptMediaIds: ["94f0792a-18e6-40c0-a480-0be6d46dbb37"], clues: [{ type: "image", mediaId: "94f0792a-18e6-40c0-a480-0be6d46dbb37" }] }).promptMediaIds.length, 1);
  assert.throws(() => parseOperation("quiz_create", { ...good, answer: { canonical: "" } }));
  assert.throws(() => parseOperation("quiz_create", { ...good, clues: [{ type: "map", map: { latitude: 100, longitude: 0 } }] }));
});

test("publishing requires an explicit confirmation and public reviews cannot modify safety", () => {
  assert.throws(() => parseOperation("quiz_publish", { id: "94f0792a-18e6-40c0-a480-0be6d46dbb37" }));
  assert.equal(parseOperation("quiz_publish", { id: "94f0792a-18e6-40c0-a480-0be6d46dbb37", confirm: true }).confirm, true);
  const schema = operations.quiz_create.schema;
  assert.equal("safetyStatus" in schema.shape, false);
});
