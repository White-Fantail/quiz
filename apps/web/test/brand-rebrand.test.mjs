import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("QuizDip is the customer-facing brand across the web app and auth", () => {
  for (const path of [
    "app/layout.tsx",
    "app/(platform)/page.tsx",
    "app/(platform)/play/page.tsx",
    "app/(platform)/discover/page.tsx",
    "app/(platform)/kids/page.tsx",
    "app/(creator)/studio/page.tsx",
    "app/sign-in/page.tsx",
    "app/account/page.tsx",
    "app/consent/page.tsx",
    "src/lib/auth.ts",
  ]) {
    const text = source(path);
    assert.match(text, /QuizDip|QUIZDIP|quizdip/, path + " needs new brand");
    assert.doesNotMatch(text, /Clupio|CLUPIO|클루피오/, path + " shows retired public brand");
  }
  assert.match(source("app/layout.tsx"), /siteName: "QuizDip"/);
  assert.match(source("src/lib/auth.ts"), /appName: "QuizDip"/);
});

test("MCP advertises QuizDip tools while keeping deprecated Clupio aliases", () => {
  const mcp = source("app/api/mcp/route.ts");
  assert.match(mcp, /new McpServer\(\{ name: "quizdip"/);
  assert.match(mcp, /\["quizdip", "clupio"\] as const/);
  assert.match(mcp, /server\.registerTool\(prefix \+ "_" \+ name/);
  assert.match(mcp, /await execute\(name, args, actor\)/);
});

test("existing signed run tokens remain valid across the rebrand", () => {
  const runs = source("src/modules/platform/runs.ts");
  assert.match(runs, /clupio:run:v1:/);
  assert.match(runs, /clupio:round:v1:/);
});
