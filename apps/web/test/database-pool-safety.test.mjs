import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const poolSource = readFileSync(new URL("../src/lib/postgres.ts", import.meta.url), "utf8");
const prismaSource = readFileSync(new URL("../src/modules/platform/db.ts", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../src/lib/auth.ts", import.meta.url), "utf8");
const buildSource = readFileSync(new URL("../../../scripts/build.mjs", import.meta.url), "utf8");

test("Prisma and Better Auth share one bounded serverless database pool", () => {
  assert.match(poolSource, /quizdipSharedPool/);
  assert.match(poolSource, /max:\s*2\b/);
  assert.match(poolSource, /connectionTimeoutMillis:\s*5_000/);
  assert.match(prismaSource, /new PrismaPg\(databasePool\(\)\)/);
  assert.match(authSource, /return databasePool\(\)/);
  assert.doesNotMatch(prismaSource, /new PrismaPg\(\{\s*connectionString/);
  assert.doesNotMatch(authSource, /new Pool\(/);
});

test("Better Auth migration uses direct URL without changing runtime connection URL", () => {
  assert.match(buildSource, /label === "Apply Better Auth migrations" && process\.env\.DIRECT_URL/);
  assert.match(buildSource, /DATABASE_URL: process\.env\.DIRECT_URL/);
  assert.match(buildSource, /spawnSync\(command, args, \{[^\n]*env: childEnv/);
});
