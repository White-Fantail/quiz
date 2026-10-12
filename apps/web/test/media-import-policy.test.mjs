import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CURATED_IMAGE_IMPORT_HOSTS, mediaImportHostAllowed } from "../src/modules/platform/import-hosts.ts";

test("trusted public image CDN hosts are explicitly curated", () => {
  assert.deepEqual(CURATED_IMAGE_IMPORT_HOSTS, [
    "upload.wikimedia.org", "images.unsplash.com", "images.pexels.com", "cdn.pixabay.com",
  ]);
  for (const host of CURATED_IMAGE_IMPORT_HOSTS) {
    assert.equal(mediaImportHostAllowed(host,"image",""),true);
    assert.equal(mediaImportHostAllowed(host,"audio",""),false);
    assert.equal(mediaImportHostAllowed(host,"video",""),false);
  }
});

test("host matching is exact, not a suffix or wildcard, and configured hosts add access", () => {
  assert.equal(mediaImportHostAllowed("upload.wikimedia.org.attacker.example","image",""),false);
  assert.equal(mediaImportHostAllowed("evil-images.unsplash.com","image",""),false);
  assert.equal(mediaImportHostAllowed("images.unsplasH.com","image",""),true);
  assert.equal(mediaImportHostAllowed("assets.example.org","audio","assets.example.org"),true);
  assert.equal(mediaImportHostAllowed("bad-assets.example.org","image","assets.example.org"),false);
  assert.equal(mediaImportHostAllowed("other.example.org","image","*.example.org"),false);
  assert.equal(mediaImportHostAllowed("other.example.org","image","https://other.example.org"),false);
});

test("import entry still gates on HTTPS, non-IP host, DNS/IP and no redirects", () => {
  const storage = readFileSync(new URL("../src/modules/platform/storage.ts",import.meta.url),"utf8");
  assert.match(storage,/url\.protocol !== "https:"/);
  assert.match(storage,/mediaImportHostAllowed\(url\.hostname, kind\)/);
  assert.match(storage,/blockedIp/);
  assert.match(storage,/lookup\(url\.hostname, \{ all: true \}\)/);
  assert.match(storage,/res\.headers\.location/);
  assert.match(storage,/size > limit/);
  assert.match(storage,/isIP\(url\.hostname\)/);
});
