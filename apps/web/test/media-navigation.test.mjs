import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mediaLibraryReturnHref } from "../src/lib/media-navigation.ts";

test("media return link preserves only in-library navigation",()=>{
  const fallback="/ko/studio/media";
  assert.equal(mediaLibraryReturnHref("/ko/studio/media?q=dog&page=2&kind=image",fallback),"/ko/studio/media?q=dog&kind=image&page=2");
  assert.equal(mediaLibraryReturnHref("/en/studio/media?sort=oldest",fallback),"/en/studio/media?sort=oldest");
  assert.equal(mediaLibraryReturnHref("//evil.example/ko/studio/media",fallback),fallback);
  assert.equal(mediaLibraryReturnHref("https://evil.example/studio/media",fallback),fallback);
  assert.equal(mediaLibraryReturnHref("/ko/studio/media/new",fallback),fallback);
  assert.equal(mediaLibraryReturnHref("/ko/studio/media?unrelated=ignored&q=x",fallback),"/ko/studio/media?q=x");
});

test("library and creation routes have separate responsibilities",()=>{
  const library=readFileSync(new URL("../app/(creator)/studio/media/media-library.tsx",import.meta.url),"utf8");
  const create=readFileSync(new URL("../app/(creator)/studio/media/new/media-create.tsx",import.meta.url),"utf8");
  const page=readFileSync(new URL("../app/(creator)/studio/media/page.tsx",import.meta.url),"utf8");
  assert.ok(!library.includes("Import an image from a URL"));
  assert.ok(!library.includes("Upload to Cloudflare R2"));
  assert.ok(create.includes('"/media/upload"'));
  assert.ok(create.includes('"/media/import"'));
  assert.ok(create.includes("mediaLibraryReturnHref"));
  assert.ok(page.includes("MediaAddButton"));
});
