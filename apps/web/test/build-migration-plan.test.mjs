import { test } from "node:test";
import assert from "node:assert/strict";
import { createBuildPlan } from "../../../scripts/build-plan.mjs";

const productionEnv = {
  VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main",
  DATABASE_URL: "postgresql://placeholder/db", BETTER_AUTH_URL: "https://quizdip.vercel.app",
  BETTER_AUTH_SECRET: "placeholder-secret",
};

test("production build migrates Prisma, then Better Auth, before Next.js", () => {
  const steps = createBuildPlan(productionEnv);
  assert.deepEqual(steps.map(({ label }) => label), [
    "Apply Prisma migrations", "Apply Better Auth migrations", "Generate Prisma client", "Build Next.js",
  ]);
  assert.ok(steps[1].args.includes("auth@1.7.7"));
});

test("preview, local and CI builds never modify a database", () => {
  for (const env of [{}, { VERCEL: "1", VERCEL_ENV: "preview", DATABASE_URL: "postgresql://example/prod" },
    { VERCEL_ENV: "production", DATABASE_URL: "postgresql://example/prod" }]) {
    assert.deepEqual(createBuildPlan(env).map(({ label }) => label), ["Generate Prisma client", "Build Next.js"]);
  }
});

test("production fails closed without required DB/auth configuration", () => {
  for (const key of ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"]) {
    const env = { ...productionEnv };
    delete env[key];
    assert.throws(() => createBuildPlan(env), /Production migration blocked/);
  }
});

test("production fails closed on a non-main branch", () => {
  assert.throws(() => createBuildPlan({ ...productionEnv, VERCEL_GIT_COMMIT_REF: "dev" }), /not from main/);
});
