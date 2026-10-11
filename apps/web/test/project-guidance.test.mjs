import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const skippedDirs = new Set([".git", "node_modules", ".next", ".vercel", "generated", "dist", "coverage"]);
const compatibilityExceptions = new Set([
  "apps/web/src/modules/platform/runs.ts", // stable v1 signed-token domain
  "apps/web/test/brand-rebrand.test.mjs", // assertions for backwards-compatible tokens
  "apps/web/test/api-mcp-parity.test.mjs", // asserts no retired MCP tool alias
]);
const oldLatin = new RegExp(["clu", "pio"].join(""), "i");
const oldHangul = new RegExp(["클루", "피오"].join(""));
const sourceFiles = /\.(md|json|mjs|js|jsx|ts|tsx|prisma|sql|yaml|yml)$/;

function walk(dir, found = []) {
  for (const filename of readdirSync(dir)) {
    const abs = join(dir, filename);
    if (statSync(abs).isDirectory()) {
      if (!skippedDirs.has(filename)) walk(abs, found);
    } else if (sourceFiles.test(filename) || filename === ".env.example") {
      found.push(abs);
    }
  }
  return found;
}

test("source, configuration and developer docs do not introduce retired branding", () => {
  for (const path of walk(root)) {
    const short = relative(root, path).replaceAll("\\", "/");
    if (compatibilityExceptions.has(short)) continue;
    const content = readFileSync(path, "utf8");
    assert.doesNotMatch(content, oldLatin, short);
    assert.doesNotMatch(content, oldHangul, short);
  }
});

test("all QuizDip agent policy references exist", () => {
  const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
  for (const name of [
    "product-principles.md", "clue-design.md", "content-policy.md",
    "creator-workflows.md", "architecture.md", "brand.md", "development-workflow.md",
  ]) {
    assert.ok(agents.includes(name), "Missing AGENTS.md link for " + name);
    assert.ok(walk(join(root, "docs")).some(path => path.endsWith(name)), name + " not present");
  }
  const rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const webPkg = JSON.parse(readFileSync(join(root, "apps/web/package.json"), "utf8"));
  const domainPkg = JSON.parse(readFileSync(join(root, "packages/domain/package.json"), "utf8"));
  assert.equal(rootPkg.name, "quizdip");
  assert.equal(webPkg.name, "@quizdip/web");
  assert.equal(domainPkg.name, "@quizdip/domain");
});
