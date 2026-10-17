import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getAdsConfig,canShowAd,publisherId} from "../src/lib/ads/config.ts";
const id="ca-pub-1234567890123456";
const live={ADSENSE_STATUS:"live",ADSENSE_CLIENT_ID:id,ADSENSE_PRIVACY_READY:"true",
  VERCEL_ENV:"production",ADSENSE_SLOT_DISCOVER_FEED:"1234567890",
  ADSENSE_SLOT_PLAY_RESULT:"9876543210"};
test("OFF, REVIEW, and missing config never render ads",()=>{
  for(const mode of [undefined,"off","review"]){
    const env=mode===undefined?{}:{...live,ADSENSE_STATUS:mode};
    assert.equal(getAdsConfig(env).enabled,false);
    assert.equal(canShowAd(getAdsConfig(env),"DISCOVER_FEED"),false);
  }
});
test("consent, valid publisher and production are mandatory",()=>{
  for(const override of [{VERCEL_ENV:"preview"},{VERCEL_ENV:"development"},
    {ADSENSE_CLIENT_ID:"bad"},{ADSENSE_CLIENT_ID:""},
    {ADSENSE_PRIVACY_READY:"false"}])
    assert.equal(getAdsConfig({...live,...override}).enabled,false);
  assert.equal(getAdsConfig(live).enabled,true);
  assert.equal(publisherId(id),id);
  assert.equal(publisherId("ca-pub-test"),"");
});
test("slots must be numeric and kids always excluded",()=>{
  const config=getAdsConfig(live);
  assert.equal(canShowAd(config,"DISCOVER_FEED"),true);
  assert.equal(canShowAd(config,"DISCOVER_FEED",true),false);
  assert.equal(canShowAd(config,"PACK_DETAIL"),false);
  assert.equal(canShowAd(getAdsConfig({...live,ADSENSE_SLOT_PLAY_RESULT:"invalid"}),"PLAY_RESULT"),false);
});
test("pre-approval and game safety guards exist in the shared UI",()=>{
  const read=(relative)=>readFileSync(new URL(relative,import.meta.url),"utf8");
  const play=read("../app/(platform)/play/page.tsx");
  const slot=read("../src/components/ads/AdSlot.tsx");
  const provider=read("../src/components/ads/AdProvider.tsx");
  const layout=read("../app/layout.tsx");
  assert.match(play,/run\.status==="FINISHED"&&<AdSlot placement="PLAY_RESULT"/);
  assert.match(play,/run\.lane==="KIDS"/);
  assert.match(read("../app/(platform)/results/[shareId]/page.tsx"),/kids=\{result\.kidsEligible\}/);
  assert.match(slot,/if\(!allowed\)return null/);
  assert.match(slot,/className=\{fullRow\?/);
  assert.doesNotMatch(read("../app/(platform)/discover/page.tsx"),/className="discover-ad-row"/);
  assert.doesNotMatch(read("../app/(platform)/packs/page.tsx"),/className="discover-ad-row"/);
  assert.match(slot,/quizdipAdInitialized/);
  assert.match(slot,/IntersectionObserver/);
  assert.match(provider,/config\.enabled&&requested/);
  assert.doesNotMatch(layout,/adsbygoogle\.js/);
});
