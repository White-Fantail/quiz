import { spawnSync } from "node:child_process";
import { createBuildPlan } from "./build-plan.mjs";

let plan;
try {
  plan = createBuildPlan(process.env);
} catch (error) {
  console.error(`[build] ${error.message}`);
  process.exit(1);
}

for (const { label, command, args } of plan) {
  console.log(`[build] ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.error) {
    console.error(`[build] ${label}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}
