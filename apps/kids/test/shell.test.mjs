import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Kids is a real native Expo app, not a webview shell",()=>{
 const pkg=JSON.parse(source("package.json")),cfg=JSON.parse(source("app.json"));
 assert.equal(pkg.main,"expo-router/entry");
 assert.match(pkg.dependencies.expo,/^~57\./);
 assert.equal(cfg.expo.ios.supportsTablet,true);
 assert.ok(cfg.expo.android.package);
 for(const page of ["index","explore","challenge","treasures"]) assert.match(source("app/(tabs)/"+page+".tsx"),/Screen/);
 assert.doesNotMatch(source("app/(tabs)/index.tsx"),/WebView/);
});
test("native discovery is read-only, locale-scoped and server-safe",()=>{
 const src=source("app/(tabs)/explore.tsx"),api=source("src/services/api.ts");
 assert.match(src,/api\.catalog\(token/);
 assert.match(source("../../packages/api-client/src/index.ts"),/kidsEligible===true/);
 assert.doesNotMatch(src,/play_guess|play_start|answer\.canonical/);
 assert.match(api,/EXPO_PUBLIC_QUIZDIP_API_URL/);
 assert.doesNotMatch(api,/DATABASE_URL|BETTER_AUTH_SECRET/);
});
test("Phase 2 only opens child routes with a validated native credential",()=>{
 const home=source("app/(tabs)/index.tsx");
 const gate=source("app/(tabs)/_layout.tsx");
 const setup=source("app/setup.tsx");
 assert.match(home,/router.push\("\/parent"\)/);
 assert.match(home,/native\.session\.profile/);
 assert.match(gate,/status!=="active"/);
 assert.match(setup,/session\.pair\(/);
});
