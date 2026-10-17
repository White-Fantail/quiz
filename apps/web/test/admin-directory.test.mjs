import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("admin landing page links to read-only platform directory", () => {
  const landing = source("app/admin/page.tsx");
  assert.match(landing, /localizeHref\("\/admin\/directory",locale\)/);
  assert.match(landing, /actor\.role !== "ADMIN"\) notFound\(\)/);
});

test("directory pages guard account data behind verified ADMIN role", () => {
  for (const page of [
    "app/admin/directory/page.tsx",
    "app/admin/directory/users/[userId]/page.tsx",
  ]) {
    const body = source(page);
    assert.match(body, /await actorFor\(/);
    assert.match(body, /if \(actor\.role !== "ADMIN"\) notFound\(\)/);
    assert.match(body, /export const dynamic = "force-dynamic"/);
    assert.match(body, /db\(\)\./);
  }
});

test("directory covers all users, packs, quizzes, and play runs", () => {
  const page = source("app/admin/directory/page.tsx");
  for (const model of ["user", "quizPack", "quiz", "playRun"]) {
    assert.match(page, new RegExp("db\\(\\)\\." + model + "\\.findMany\\("));
    assert.match(page, new RegExp("db\\(\\)\\." + model + "\\.count\\("));
  }
  assert.match(page, /take: LIMIT/);
  assert.match(page, /skip/);
});

test("completed-question list excludes unfinished sessions and protects child records", () => {
  const page = source("app/admin/directory/users/[userId]/page.tsx");
  assert.match(page, /status: \{ in: \["SOLVED", "FAILED"\] \}/);
  assert.match(page, /db\(\)\.playSession\.findMany/);
  assert.match(page, /db\(\)\.playRun\.findMany/);
  assert.match(page, /kidOwnership/);
});
