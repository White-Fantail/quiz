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
 assert.match(src,/api\.kidsCatalog\(locale/);
 assert.match(src,/kidsEligible/); // Contract is fail-closed in the shared API client.
 assert.doesNotMatch(src,/play_guess|play_start|answer\.canonical/);
 assert.match(api,/EXPO_PUBLIC_QUIZDIP_API_URL/);
 assert.doesNotMatch(api,/DATABASE_URL|BETTER_AUTH_SECRET/);
});
test("Phase 1 keeps parent-protected features as future work",()=>{
 const home=source("app/(tabs)/index.tsx");
 assert.match(home,/native\.setupRequired/);
 assert.match(home,/native\.languageNote/);
});
