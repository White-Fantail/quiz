import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_LOCALE, isLocale, localeFromPath, stripLocale, localizeHref, localeFromAcceptLanguage } from "../src/i18n/core.ts";
import { MESSAGES, t } from "../src/i18n/messages.ts";
import { operations, parseOperation } from "../src/modules/platform/contracts.ts";

const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("locale path routing is deterministic and never prefixes protected API namespaces", () => {
  assert.equal(DEFAULT_LOCALE, "en");
  assert.equal(isLocale("ja"), false);
  assert.equal(localeFromPath("/en/discover"), "en");
  assert.equal(stripLocale("/ko"), "/");
  assert.equal(localizeHref("/en/play/123?x=y", "ko"), "/ko/play/123?x=y");
  assert.equal(localizeHref("/studio", "en"), "/en/studio");
  assert.equal(localizeHref("/api/v1/catalog", "ko"), "/api/v1/catalog");
  assert.equal(localizeHref("/.well-known/oauth-authorization-server", "ko"), "/.well-known/oauth-authorization-server");
  assert.equal(localizeHref("https://example.com", "en"), "https://example.com");
  assert.equal(localeFromAcceptLanguage("ko-KR,ko;q=0.9,en;q=0.8"), "ko");
  assert.equal(localeFromAcceptLanguage("fr-FR,ja;q=0.8"), "en");
  assert.equal(localeFromAcceptLanguage("ko;q=0,en;q=0.3"), "en");
});

test("all supported locales have the same nonempty typed message keys", () => {
  const keys = Object.keys(MESSAGES.en).sort();
  assert.deepEqual(Object.keys(MESSAGES.ko).sort(), keys);
  for (const locale of ["ko", "en"]) for (const key of keys) {
    assert.ok(t(locale, key).trim().length > 0, locale + ": " + key);
  }
  assert.equal(t("ko", "nav.account"), "내 계정");
});

test("authenticated locale preference is validated on both REST and MCP registry", () => {
  assert.equal(operations.locale_get.public, false);
  assert.equal(operations.locale_update.public, false);
  assert.equal(parseOperation("locale_update", { locale: "ko" }).locale, "ko");
  assert.throws(() => parseOperation("locale_update", { locale: "ja" }));
  assert.equal("userId" in parseOperation("locale_update", { locale: "en", userId: "another-user" }), false);
  const route = source("app/api/v1/[...segments]/route.ts");
  assert.match(route, /op: "locale_get"/);
  assert.match(route, /op: "locale_update"/);
  const proxy = source("proxy.ts");
  assert.match(proxy, /bypass\(pathname\)/);
  assert.match(proxy, /NextResponse\.rewrite/);
});

test("additive schema preserves revisions, avoids fake English classification", () => {
  const schema = source("../../prisma/schema.prisma");
  const migration = source("../../prisma/migrations/20261012070000_multilingual_foundation/migration.sql");
  assert.match(schema, /model QuizLocalization/);
  assert.match(schema, /model QuizPackLocalization/);
  assert.match(schema, /model TopicLocalization/);
  assert.match(migration, /'und'/);
  assert.match(migration, /UPDATE "QuizRevision"/);
  assert.doesNotMatch(migration, /DROP TABLE "QuizRevision"/);
});
