import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createBuildPlan } from "./build-plan.mjs";

// Vercel invokes this script from apps/web, while local and CI builds start at the repo root.
// Always execute Prisma/Auth migration paths and npm workspace commands at the repository root.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let plan;
try {
  plan = createBuildPlan(process.env);
} catch (error) {
  console.error(`[build] ${error.message}`);
  process.exit(1);
}

for (const { label, command, args } of plan) {
  console.log(`[build] ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false, cwd: repoRoot });
  if (result.error) {
    console.error(`[build] ${label}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}
