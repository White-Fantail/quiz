import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Studio highlights AI creator without removing manual creation and quiz management", () => {
  const page = read("app/(creator)/studio/page.tsx");
  assert.match(page, /StudioAiOnboarding/);
  assert.match(page, /\/studio\/ai/);
  assert.match(page, /\/studio\/quizzes\/new/);
  assert.match(page, /\/studio\/packs\/new/);
  assert.match(page, /StudioWorkspace/);
});

test("AI creator uses server-configured authenticated MCP endpoint, not a guessed URL", () => {
  const page = read("app/(creator)/studio/ai/page.tsx");
  const studio = read("app/(creator)/studio/page.tsx");
  const auth = read("src/lib/auth.ts");
  assert.match(page, /mcpResource/);
  assert.match(studio, /mcpUrl=\{mcpResource\}/);
  assert.match(auth, /mcpResource = siteOrigin \+ "\/api\/mcp"/);
  assert.doesNotMatch(page, /localhost|\.vercel\.app/);
});

test("AI creator offers URL copy, explicit feedback and a clipboard fallback", () => {
  const intro = read("app/(creator)/studio/studio-ai-onboarding.tsx");
  assert.match(intro, /navigator\.clipboard\?\.writeText/);
  assert.match(intro, /document\.execCommand\("copy"\)/);
  assert.match(intro, /MCP 주소 복사하기/);
  assert.match(intro, /aria-label=.*MCP/);
  assert.match(intro, /localStorage\.setItem/);
  assert.match(intro, /window\.localStorage\.getItem/);
  assert.match(intro, /"guest"/);
  assert.match(intro, /베타 제공 중/);
  assert.match(intro, /ChatGPT 플러그인 페이지 열기/);
  assert.match(intro, /https:\/\/chatgpt\.com\/plugins/);
});
