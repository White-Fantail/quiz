/** Pure deployment build plan: keep database writes out of CI, preview, and local builds. */
export function createBuildPlan(env) {
  const production = env.VERCEL === "1" && env.VERCEL_ENV === "production";
  const steps = [];

  if (production) {
    if (!env.DATABASE_URL) {
      throw new Error("Production migration blocked: DATABASE_URL is not configured.");
    }
    if (!env.BETTER_AUTH_URL || !env.BETTER_AUTH_SECRET) {
      throw new Error("Production migration blocked: BETTER_AUTH_URL and BETTER_AUTH_SECRET are required.");
    }
    if (env.VERCEL_GIT_COMMIT_REF && env.VERCEL_GIT_COMMIT_REF !== "main") {
      throw new Error("Production migration blocked: this build is not from main.");
    }
    steps.push(
      { label: "Apply Prisma migrations", command: "npm", args: ["run", "db:migrate"] },
      { label: "Apply Better Auth migrations", command: "npx", args: ["--yes", "auth@1.7.7", "migrate", "--config", "./apps/web/src/lib/auth.ts", "--yes"] },
    );
  }

  steps.push(
    { label: "Generate Prisma client", command: "npm", args: ["run", "db:generate"] },
    { label: "Build Next.js", command: "npm", args: ["run", "build:next", "--workspace", "@quizdip/web"] },
  );
  return steps;
}
