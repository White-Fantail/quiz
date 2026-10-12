import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("admin dashboard belongs to My Account heading, not the play records section", () => {
  const source = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");
  const heading = source.match(/<header className="account-page-heading">([\s\S]*?)<\/header>/)?.[1];

  assert.ok(heading, "account heading should exist");
  assert.match(heading, /\{isAdmin && <Link/);
  assert.match(heading, /href=\{localizeHref\("\/admin", locale\)\}/);
  assert.match(heading, /className="btn btn-outline account-admin-link"/);
  assert.equal((source.match(/msg\("account.admin"\)/g) ?? []).length, 1);
  assert.ok(source.indexOf("<MyStatsPanel />") > source.indexOf("</header>"),
    "play records must appear after the account-level admin link");

  const css = readFileSync(new URL("../app/management.css", import.meta.url), "utf8");
  assert.match(css, /\.account-page-heading\{display:flex/);
});
