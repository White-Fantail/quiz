import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transientDatabaseConnectionCode, retryTransientDatabaseRead } from "../src/lib/database-read-retry.ts";

test("transient connection errors are recognized through driver adapters", () => {
  assert.equal(transientDatabaseConnectionCode(Object.assign(new Error("socket reset"), { code: "ECONNRESET" })), "ECONNRESET");
  assert.equal(transientDatabaseConnectionCode({ meta: { driverAdapterError: { cause: { code: "08006" } } } }), "08006");
  assert.equal(transientDatabaseConnectionCode({ code: "23505" }), null);
  assert.equal(transientDatabaseConnectionCode(new Error("unrelated failure")), null);
});

test("only transient failures retry and a successful second read is returned", async () => {
  let attempts = 0;
  const result = await retryTransientDatabaseRead(async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error("socket reset"), { code: "ECONNRESET" });
    return 42;
  });
  assert.equal(result, 42);
  assert.equal(attempts, 2);
});

test("non-connection failures propagate without retry", async () => {
  let attempts = 0;
  const error = Object.assign(new Error("unique conflict"), { code: "23505" });
  await assert.rejects(() => retryTransientDatabaseRead(async () => {
    attempts += 1;
    throw error;
  }), (actual) => actual === error);
  assert.equal(attempts, 1);
});

test("persistent connection failures stop after a single retry", async () => {
  let attempts = 0;
  await assert.rejects(() => retryTransientDatabaseRead(async () => {
    attempts += 1;
    throw Object.assign(new Error("still disconnected"), { code: "ECONNRESET" });
  }), { code: "ECONNRESET" });
  assert.equal(attempts, 2);
});

test("retry is limited to Better Auth session and identity reads", () => {
  const src = readFileSync(new URL("../src/modules/platform/auth.ts", import.meta.url), "utf8");
  assert.match(src, /retryTransientDatabaseRead\(\(\) => auth\.api\.getSession/);
  assert.match(src, /retryTransientDatabaseRead\(\(\) => authPool\(\)\.query/);
  assert.doesNotMatch(src, /retryTransientDatabaseRead\(\(\) => db\(\)\.user\.upsert/);
});
