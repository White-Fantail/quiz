import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pinnedLookup } from "../src/modules/platform/pinned-lookup.ts";

test("HTTPS lookup with all:true receives a DNS address array, not a string", () => {
  const lookup = pinnedLookup({ address: "93.184.215.14", family: 4 });
  lookup("upload.wikimedia.org", { all: true }, (error, addresses) => {
    assert.equal(error, null);
    assert.deepEqual(addresses, [{ address: "93.184.215.14", family: 4 }]);
  });
});

test("HTTPS lookup without all:true retains legacy address/family callback", () => {
  const lookup = pinnedLookup({ address: "2606:4700::1111", family: 6 });
  lookup("images.unsplash.com", { all: false }, (error, address, family) => {
    assert.equal(error, null);
    assert.equal(address, "2606:4700::1111");
    assert.equal(family, 6);
  });
});

test("HTTPS import uses pinned lookup and rejects unsafe resolved IPs before connection", () => {
  const source = readFileSync(new URL("../src/modules/platform/storage.ts", import.meta.url), "utf8");
  assert.match(source, /lookup\(url\.hostname, \{ all: true \}\)/);
  assert.match(source, /addresses\.some\(a => blockedIp\(a\.address\)\)/);
  assert.match(source, /lookup: pinnedLookup\(\{ address: chosen\.address, family \}\)/);
  assert.match(source, /res\.headers\.location/);
});
