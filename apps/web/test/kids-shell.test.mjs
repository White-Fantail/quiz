import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KIDS_TABS, isKidsPath, kidsHref } from "../src/modules/kids/navigation.ts";
import { MESSAGES } from "../src/i18n/messages.ts";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Kids shell has an isolated locale-aware navigation allowlist", () => {
  assert.equal(isKidsPath("/kids"), true);
  assert.equal(isKidsPath("/kids/explore"), true);
  assert.equal(isKidsPath("/kids/challenge"), true);
  assert.equal(isKidsPath("/kidstuff"), false);
  assert.equal(isKidsPath("/studio"), false);
  assert.deepEqual(KIDS_TABS.map(tab => tab.path),
    ["/kids", "/kids/explore", "/kids/challenge", "/kids/treasures"]);
  assert.equal(kidsHref("/kids/explore", "en"), "/en/kids/explore");
  assert.equal(kidsHref("/kids/treasures", "ko"), "/ko/kids/treasures");
  assert.throws(() => kidsHref("/studio", "en"));
  assert.throws(() => kidsHref("/play", "ko"));
});

test("Root chrome is excluded on all Kids routes via a trusted rewritten path marker", () => {
  const root = read("app/layout.tsx");
  const proxy = read("proxy.ts");
  const kidsLayout = read("app/(platform)/kids/layout.tsx");
  assert.match(proxy, /headers.set\("x-quizdip-shell", isKidsPath\(resolvedPath\) \? "kids" : "general"\)/);
  assert.match(root, /kidsShell \? children :/);
  assert.match(kidsLayout, /<main className="kids-main" id="kids-content">/);
  assert.match(kidsLayout, /KIDS_TABS\.map/);
  assert.doesNotMatch(kidsLayout, /href=.*\/(?:play|discover|studio|account)/);
});

test("Kids pages stay in their own localized shell without leaking general-app navigation", () => {
  const paths = [
    "app/(platform)/kids/page.tsx",
    "app/(platform)/kids/explore/page.tsx",
    "app/(platform)/kids/challenge/page.tsx",
    "app/(platform)/kids/treasures/page.tsx",
  ];
  for (const path of paths) {
    const page = read(path);
    assert.match(page, /kids\.|KidsGallery/);
    assert.doesNotMatch(page, /localizeHref\("\/(?:play|discover|studio|account)/);
  }
  for (const [key, value] of Object.entries(MESSAGES.en)) {
    if (!key.startsWith("kids.")) continue;
    assert.ok(value.trim());
    assert.ok(MESSAGES.ko[key]?.trim(), key);
  }
});

test("Kids discovery requests strict published language and trusted Kids approval", () => {
  const gallery = read("app/(platform)/kids/explore/kids-gallery.tsx");
  const quizService = read("src/modules/platform/quiz.ts");
  assert.match(gallery, /discoverQuery\(\{ answerType: type, kids: true, locale,/);
  assert.match(gallery, /quiz\.kidsEligible === true/);
  assert.doesNotMatch(gallery, /href=.*\/play/);
  assert.match(quizService, /playableQuizWhere\(locale, p\.kids \? "KIDS" : "GENERAL"\)/);
});
