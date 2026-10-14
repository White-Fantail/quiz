import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Kids is a real native Expo app, not a webview shell",()=>{
 const pkg=JSON.parse(source("package.json")),cfg=JSON.parse(source("app.json"));
 assert.equal(pkg.main,"expo-router/entry");
 assert.match(pkg.dependencies.expo,/^~57\./);
 assert.deepEqual(cfg.expo.platforms,["ios","android","web"]);
 assert.equal(cfg.expo.web.bundler,"metro");
 assert.equal(pkg.dependencies["react-dom"],pkg.dependencies.react);
 assert.match(pkg.dependencies["react-native-web"],/^\^0\.21\./);
 assert.match(pkg.dependencies["@expo/metro-runtime"],/^~57\./);
 assert.equal(cfg.expo.ios.supportsTablet,true);
 assert.ok(cfg.expo.android.package);
 for(const page of ["index","explore","challenge","treasures"]) assert.match(source("app/(tabs)/"+page+".tsx"),/Screen/);
 assert.doesNotMatch(source("app/(tabs)/index.tsx"),/WebView/);
});
test("native discovery is read-only, locale-scoped and server-safe",()=>{
 const src=source("app/(tabs)/explore.tsx"),api=source("src/services/api.ts");
 const discovery=source("src/useKidsAdventures.ts");
 assert.match(discovery,/kidsApi\.catalog\(token/);
 assert.match(discovery,/kidsApi\.packs\(token/);
 assert.match(discovery,/kidsApi\.features\(token/);
 assert.match(discovery,/time\.status!=="allowed"/);
 assert.match(source("../../packages/api-client/src/index.ts"),/kidsEligible===true/);
 assert.doesNotMatch(src,/play_guess|play_start|answer\.canonical/);
 assert.match(api,/export const KIDS_API_ORIGIN = "https:\/\/quizdip\.vercel\.app"/);
 assert.doesNotMatch(api,/process\.env|EXPO_PUBLIC_QUIZDIP_API_URL/);
 for(const client of ["QuizDipPublicApi","QuizDipKidsDeviceApi","QuizDipKidsParentApi"])
  assert.ok(api.includes("new "+client+"(KIDS_API_ORIGIN)"));
 assert.doesNotMatch(api,/DATABASE_URL|BETTER_AUTH_SECRET/);
});
test("Phase 2 only opens child routes with a validated native credential",()=>{
 const home=source("app/(tabs)/index.tsx");
 const gate=source("app/(tabs)/_layout.tsx");
 const setup=source("app/setup.tsx");
 assert.match(home,/go\("\/parent"\)/);
 assert.match(home,/native\.home\.hello/);
 assert.match(gate,/status!=="active"/);
 assert.match(setup,/session\.claimPair\(/);
 assert.match(setup,/QRCode/);
 assert.match(setup,/request\.shortCode/);
});

test("browser-only preview never imports child credentials or live backend",()=>{
 const preview=source("src/web/Preview.tsx");
 assert.match(source("app/_layout.web.tsx"),/Slot/);
 assert.match(source("app/(tabs)/_layout.web.tsx"),/Slot/);
 assert.match(preview,/BROWSER PREVIEW|브라우저 미리보기/);
 assert.doesNotMatch(preview,/SecureStore|localStorage|sessionStorage|fetch\(|kidsApi|parentApi|EXPO_PUBLIC_|Authorization/);
 assert.match(source("app/_layout.tsx"),/KidsSessionProvider/);
 for(const page of ["setup","game","parent","guardian","time-up"])
   assert.match(source("app/"+page+".web.tsx"),/Preview/);
});

test("Kids home uses a personal greeting and compact PIN-guarded parents entry",()=>{
 const home=source("app/(tabs)/index.tsx");
 const screen=source("src/components/Screen.tsx");
 const gate=source("app/parent.tsx");
 const locales=source("../../packages/i18n/src/kids.ts");
 assert.match(home,/session\.profile\.nickname\.trim\(\)/);
 assert.match(home,/headerAction=\{<KidsTap/);
 assert.match(home,/go\("\/parent"\)/);
 assert.doesNotMatch(home,/styles\.locale|native\.session\.pinned/);
 assert.match(screen,/headerAction\?:ReactNode/);
 assert.match(gate,/parent\.authorize\(pin\)/);
 assert.match(locales,/"native\.home\.hello": "Hello"/);
 assert.match(locales,/"native\.home\.hello": "안녕"/);
});


test("native Kids decorative icons are font-independent SVGs",()=>{
 const icon=source("src/components/KidsIcon.tsx");
 assert.match(icon,/from "react-native-svg"/);
 for(const emoji of ["🏠","🧭","📚","🧩","⭐","✨","🦕","🦁","🌍","🚀","🔒","👨‍👩‍👧"])
   assert.ok(icon.includes(`"${emoji}"`),`missing vector icon mapping for ${emoji}`);
 assert.match(source("app/(tabs)/_layout.tsx"),/tabBarIcon:\(\{color\}\)=> <KidsEmojiIcon/);
 assert.doesNotMatch(source("app/(tabs)/_layout.tsx"),/fontSize:23/);
 for(const path of ["src/components/Screen.tsx","src/components/AdventureTile.tsx"])
   assert.match(source(path),/<KidsEmojiIcon/);
 for(const path of ["app/(tabs)/explore.tsx","app/(tabs)/packs.tsx","app/(tabs)/challenge.tsx",
   "app/(tabs)/treasures.tsx","app/game.tsx","app/guardian.tsx","app/time-up.tsx"])
   assert.match(source(path),/KidsEmojiIcon/);
});


test("Home and Explore use one adventure taxonomy with pack-first discovery",()=>{
 const home=source("app/(tabs)/index.tsx");
 const explore=source("app/(tabs)/explore.tsx");
 const adventure=source("src/adventures.ts");
 const art=source("src/components/AdventureArtwork.tsx");
 const card=source("src/components/AdventureTile.tsx");
 const tabs=source("app/(tabs)/_layout.tsx");
 const locale=source("../../packages/i18n/src/kids.ts");
 assert.match(home,/adventures\.filter/);
 assert.match(home,/adventureCount/);
 assert.match(home,/params:\{adventure:item\.id\}/);
 assert.match(home,/useKidsAdventures/);
 assert.match(explore,/adventures\.map/);
 assert.match(explore,/useKidsAdventures/);
 assert.match(explore,/shownPacks\.map/);
 assert.match(explore,/shownQuizzes\.map/);
 assert.ok(explore.indexOf("shownPacks.map")<explore.indexOf("shownQuizzes.map"),"show packs before single quizzes");
 assert.match(explore,/adventureById\(routeAdventure\)/);
 assert.match(adventure,/id:"dinosaur"/);
 for(const id of ["dinosaur","animals","space","math","patterns","time","world","things","science","surprise"]){
  assert.ok(adventure.includes('id:"'+id+'"'),"missing adventure "+id);
  assert.ok(art.includes('id==="'+id+'"'),"missing vector art "+id);
  assert.ok(locale.includes('"native.adventure.'+id+'":'),"missing EN/KO label "+id);
 }
 assert.match(card,/<AdventureArtwork/);
 assert.match(art,/react-native-svg/);
 assert.match(tabs,/<Tabs.Screen name="packs" options=\{\{href:null\}\}/);
 assert.doesNotMatch(tabs,/\{name:"packs",label:/);
 assert.doesNotMatch(source("src/useKidsAdventures.ts"),/QuizDipPublicApi|publicApi|Authorization:/);
});


test("Challenge missions reuse child-approved packs, saved progress, and native game routes",()=>{
 const challenge=source("app/(tabs)/challenge.tsx");
 const game=source("app/game.tsx");
 const locale=source("../../packages/i18n/src/kids.ts");
 assert.match(challenge,/useKidsAdventures/);
 assert.match(challenge,/packs\.slice\(0,4\)/);
 assert.match(challenge,/mode:"RANDOM_FIVE"/);
 assert.match(challenge,/packId:pack\.id/);
 assert.match(challenge,/SecureStore\.getItemAsync\(SAVED_GAME\)/);
 assert.match(challenge,/canResume\?<KidsTap/);
 assert.match(game,/quizdip-kids-active-game-v1/);
 assert.match(challenge,/AdventureArtwork/);
 for(const key of ["native.challenge.start","native.challenge.packHeading","native.challenge.resumeDetail"])
   assert.ok(locale.includes('"'+key+'"'));
 assert.doesNotMatch(challenge,/publicApi|leaderboard|reviewUpsert/);
});

test("Treasures are a private, server-backed collection with honest earned and locked badges",()=>{
 const treasures=source("app/(tabs)/treasures.tsx");
 const server=source("../web/src/modules/kids/game.ts");
 const artwork=source("src/components/TreasureChestArtwork.tsx");
 const locale=source("../../packages/i18n/src/kids.ts");
 assert.match(treasures,/useFocusEffect/);
 assert.match(treasures,/kidsApi\.treasures\(token\)/);
 assert.match(treasures,/badgeSlots\.map/);
 assert.match(treasures,/earned\.has\(badge\.id\)/);
 assert.match(treasures,/data\.discoveries\.map/);
 assert.match(treasures,/go\("\/explore"\)/);
 for(const id of ["first","five","ten"]) {
   assert.ok(treasures.includes('id:"'+id+'"'));
   assert.ok(server.includes('id:"'+id+'"'));
 }
 assert.match(artwork,/react-native-svg/);
 assert.doesNotMatch(treasures,/publicApi|leaderboard|AsyncStorage/);
 for(const key of ["native.treasure.collection","native.treasure.unlocked","native.treasure.locked","native.treasure.more"])
   assert.ok(locale.includes('"'+key+'"'));
});
