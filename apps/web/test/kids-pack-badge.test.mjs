import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Kids label is bilingual, conditional and derived from approved pack metadata",()=>{
  const badge=read("src/components/kids-pack-badge.tsx");
  assert.match(badge,/if\(!eligible\)return null/);
  assert.match(badge,/locale==="ko"\?"어린이용":"Kids"/);
  const social=read("src/modules/platform/social.ts");
  assert.match(social,/kidsReviewStatus:pack.kidsReviewStatus,kidsEligible:pack.kidsEligible/);
  const ranked=read("src/modules/platform/discovery.ts");
  assert.match(ranked,/orderMode:true,kidsEligible:true/);
  assert.match(ranked,/kidsEligible:pack.kidsEligible/);
});

test("every public pack presentation has Kids badge, without tagging all quiz content",()=>{
  for(const path of [
    "app/(platform)/discover/pack-browser.tsx",
    "app/(platform)/discover/pack-spotlight.tsx",
    "app/(platform)/discover/discovery-sections.tsx",
    "app/(platform)/packs/page.tsx",
    "app/(platform)/packs/[packId]/page.tsx"
  ]){
    const source=read(path);
    assert.match(source,/KidsPackBadge/,"Missing badge in "+path);
    assert.match(source,/eligible=\{(?:pack|item)\.kidsEligible\}/,"Missing approved eligibility binding in "+path);
  }
  const cards=read("app/(platform)/discover/discovery-sections.tsx");
  assert.match(cards,/item.type==="PACK"&&<KidsPackBadge/);
  assert.match(read("app/globals.css"),/\.small-tag\.kids-pack-tag/);
  assert.match(read("app/globals.css"),/\.pack-type-badges/);
});
