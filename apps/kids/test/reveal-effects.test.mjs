import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const kidView=readFileSync(new URL("../src/components/KidClueView.tsx",import.meta.url),"utf8");
const webView=readFileSync(new URL("../../web/src/components/image-reveal.tsx",import.meta.url),"utf8");

test("Kids and web support zoom and spotlight without any blur renderer",()=>{
  assert.match(kidView,/reveal\.effect==="zoom"/);
  assert.match(kidView,/reveal\.effect==="spotlight"/);
  assert.match(kidView,/spotlightRevealRadiusPixels\(strength,layout\.width,layout\.height\)/);
  assert.match(kidView,/mediaStage\.type==="image-reveal"/);
  assert.match(kidView,/contentFit="contain"/);
  assert.doesNotMatch(kidView,/blurRadius|nativeRevealBlurRadius|reveal-blur/);
  assert.match(webView,/spotlightRevealRadiusPercent\(strength\)/);
  assert.doesNotMatch(webView,/style\.filter|reveal\.effect==="blur"/);
});

test("archived unsupported effects have an unmodified-image fallback",()=>{
  assert.match(webView,/Unsupported historical effects show the original image/);
  assert.doesNotMatch(kidView,/blurRadius/);
});
