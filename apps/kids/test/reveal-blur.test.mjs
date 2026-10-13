import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nativeRevealBlurRadius } from "../src/components/reveal-blur.ts";

const imageClue = readFileSync(new URL("../src/components/KidClueView.tsx",import.meta.url),"utf8");

test("Kids native blur shows noticeably stronger reveal than the old web-scaled radius",()=>{
  assert.equal(nativeRevealBlurRadius(24,"web"),7.2);
  assert.equal(nativeRevealBlurRadius(24,"ios"),34.8);
  assert.equal(nativeRevealBlurRadius(24,"android"),24);
  assert.ok(nativeRevealBlurRadius(24,"ios")>nativeRevealBlurRadius(24,"web"));
});

test("clear image stays perfectly clear; additional strength always increases or preserves blur",()=>{
  for(const platform of ["ios","android","web"]){
    assert.equal(nativeRevealBlurRadius(0,platform),0);
    const radii=[0,1,12,24,50,95,100].map(x=>nativeRevealBlurRadius(x,platform));
    for(let i=1;i<radii.length;i++)assert.ok(radii[i]>radii[i-1]||i===radii.length-1,
      `${platform} should not weaken blur at higher strength: ${radii}`);
    assert.ok(radii.at(-1)<=(platform==="ios"?72:60));
  }
  assert.ok(nativeRevealBlurRadius(NaN,"ios")>0);
  assert.ok(nativeRevealBlurRadius(Infinity,"android")>0);
});

test("image-reveal uses Expo Image's cross-platform blur and refreshes on stage changes",()=>{
  assert.match(imageClue,/from "expo-image"/);
  assert.match(imageClue,/nativeRevealBlurRadius\(strength,Platform\.OS\)/);
  assert.match(imageClue,/key=\{\`\$\{reveal\.effect\}:\$\{blurRadius\}\`\}/);
  assert.match(imageClue,/blurRadius=\{blurRadius\}/);
  assert.match(imageClue,/contentFit="contain"/);
  assert.match(imageClue,/mediaStage:KidClue\|null/);
  assert.match(imageClue,/mediaStage\.type==="image-reveal"/);
  assert.doesNotMatch(imageClue,/Image as NativeImage/);
  assert.doesNotMatch(imageClue,/strength\*0\.30/);
  assert.match(imageClue,/reveal\.effect==="spotlight"/);
  assert.match(imageClue,/reveal\.effect==="zoom"/);
});
