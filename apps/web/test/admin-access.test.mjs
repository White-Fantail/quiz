import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("admin landing page checks the real web session and domain role", () => {
  const page = source("app/admin/page.tsx");
  assert.match(page, /export const dynamic\s*=\s*"force-dynamic"/);
  assert.match(page, /await actorFor\(/);
  assert.match(page, /if \(!actor\) redirect\(localizeHref\("\/sign-in\?callbackURL=%2Fadmin",locale\)\)/);
  assert.match(page, /if \(actor\.role !== "ADMIN"\) notFound\(\)/);
  assert.match(page, /href=\{localizeHref\("\/admin\/quiz-review",locale\)\}/);
  assert.doesNotMatch(page, /href=\{localizeHref\("\/admin\/weekly",locale\)\}/);
});

test("account page offers the admin link only after trusted role lookup", () => {
  const page = source("app/account/page.tsx");
  assert.match(page, /actorByIdentity\(session\.user\.id\)/);
  assert.match(page, /\.role === "ADMIN"/);
  assert.match(page, /\{isAdmin &&/);
  // Admin link remains behind trusted role checks; user-facing URL now includes the locale.
  assert.match(page, /href=\{localizeHref\("\/admin", locale\)\}/);
});

test("admin subpages and moderation operations continue to enforce ADMIN", () => {
  const review = source("app/admin/quiz-review/page.tsx");
  const editorial = source("app/admin/features/page.tsx");
  const quiz = source("src/modules/platform/quiz.ts");
  assert.match(review, /actor\.role\s*!==\s*"ADMIN"/);
  assert.match(editorial, /actor\.role\s*!==\s*"ADMIN"/);
  assert.match(quiz, /admin\.role\s*!==\s*"ADMIN"/);
});
