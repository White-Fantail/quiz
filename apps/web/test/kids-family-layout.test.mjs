import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("parent Kids settings share scoped, responsive form styling", () => {
  const css = read("app/globals.css");
  const page = read("app/account/kids/page.tsx");
  const family = read("app/account/kids/family-settings.tsx");
  const pair = read("app/account/kids/pair-approval.tsx");

  assert.match(page, /className="container inner-page kids-settings-page"/);
  assert.match(family, /className="kids-settings-stack"/);
  assert.match(family, /className="kids-settings-card kids-pin-card"/);
  assert.match(pair, /className="kids-settings-card kids-pair-card"/);
  assert.match(css, /\.kids-settings-page \.kids-form-field input,/);
  assert.match(css, /\.kids-settings-page \.kids-form-field select/);
  assert.match(css, /\.kids-settings-list-row/);
  assert.match(css, /@media\(max-width:820px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.doesNotMatch(family, /style=\{\{display:"grid"/);
  assert.doesNotMatch(pair, /style=\{\{display:"grid"/);
});

test("pairing remains PIN-protected and keeps QR and code fallbacks", () => {
  const pair = read("app/account/kids/pair-approval.tsx");
  const connect = read("app/account/kids/connect/page.tsx");
  const translations = read("../../packages/i18n/src/kids.ts");
  assert.match(pair, /action:"native_pair_approve"/);
  assert.match(pair, /qrToken\?\{qrToken\}:\{shortCode:/);
  assert.match(pair, /pattern="\[0-9\]\{6\}"/);
  assert.match(pair, /setPin\(e\.target\.value\.replace/);
  assert.match(connect, /PairApproval qrToken=\{token\}/);
  assert.match(translations, /"kids\.native\.pairHelp": "Create a child profile and guardian PIN/);
});
