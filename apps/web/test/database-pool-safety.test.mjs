import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const poolSource = readFileSync(new URL("../src/lib/postgres.ts", import.meta.url), "utf8");
const prismaSource = readFileSync(new URL("../src/modules/platform/db.ts", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../src/lib/auth.ts", import.meta.url), "utf8");
const buildSource = readFileSync(new URL("../../../scripts/build.mjs", import.meta.url), "utf8");
const prismaConfigSource = readFileSync(new URL("../../../prisma.config.ts", import.meta.url), "utf8");

test("Prisma and Better Auth share one bounded serverless database pool", () => {
  assert.match(poolSource, /quizdipSharedPool/);
  assert.match(poolSource, /connectionString:\s*process\.env\.DATABASE_URL_POOLED\s*\|\|\s*process\.env\.DATABASE_URL/);
  assert.match(poolSource, /max:\s*2\b/);
  assert.match(poolSource, /connectionTimeoutMillis:\s*15_000/);
  assert.match(poolSource, /pool\.on\("error",/);
  assert.match(poolSource, /waitingCount: pool\.waitingCount/);
  assert.match(prismaSource, /DATABASE_URL_POOLED && !process\.env\.DATABASE_URL/);
  assert.match(prismaSource, /new PrismaPg\(databasePool\(\)\)/);
  assert.match(authSource, /return databasePool\(\)/);
  assert.doesNotMatch(prismaSource, /new PrismaPg\(\{\s*connectionString/);
  assert.doesNotMatch(authSource, /new Pool\(/);
});

test("migration tooling bypasses the runtime pool and prefers a direct database URL", () => {
  assert.match(prismaConfigSource, /process\.env\.DIRECT_URL \|\| process\.env\.DATABASE_URL/);
  assert.doesNotMatch(prismaConfigSource, /DATABASE_URL_POOLED/);
  assert.match(buildSource, /label === "Apply Better Auth migrations"/);
  assert.match(buildSource, /DATABASE_URL: process\.env\.DIRECT_URL \|\| process\.env\.DATABASE_URL/);
  assert.match(buildSource, /DATABASE_URL_POOLED: ""/);
  assert.match(buildSource, /spawnSync\(command, args, \{[^\n]*env: childEnv/);
});
