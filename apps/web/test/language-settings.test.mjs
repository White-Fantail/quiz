import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("language is an account setting, not global navigation; guests can still change it", () => {
  const shell = source("app/layout.tsx");
  const account = source("app/account/page.tsx");
  const settings = source("app/account/settings/page.tsx");
  const switcher = source("src/i18n/language-switcher.tsx");
  assert.doesNotMatch(shell, /<LanguageSwitcher\s*\/>/);
  assert.match(account, /localizeHref\("\/account\/settings",locale\)/);
  assert.match(settings, /<LanguageSwitcher\s*\/>/);
  assert.doesNotMatch(settings, /getSession|auth\.api/);
  assert.match(switcher, /LOCALE_COOKIE/);
  assert.match(switcher, /\/api\/v1\/me\/locale/);
});

test("Kids retains an independent parent-locked language per profile", () => {
  const adult = source("app/account/kids/family-settings.tsx");
  const root = source("../kids/app/_layout.tsx");
  const home = source("../kids/app/(tabs)/index.tsx");
  const guardian = source("../kids/app/guardian.tsx");
  assert.match(adult, /value=\{draft\.locale\}/);
  assert.match(guardian, /setField\("locale",v\)/);
  assert.match(root, /chooseLocale\(session\.session\.profile\.locale\)/);
  assert.match(home, /native\.session\.pinned/);
  assert.doesNotMatch(home, /chooseLocale\(/);
});
