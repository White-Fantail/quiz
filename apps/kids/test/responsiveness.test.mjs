import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Kids quiz input is single-flight and gives immediate feedback",()=>{
 const game=source("app/game.tsx");
 const tap=source("src/components/KidsTap.tsx");
 assert.match(game,/if\(pendingRef\.current\)return;/);
 assert.match(game,/pendingRef\.current=true/);
 assert.match(game,/finally\{pendingRef\.current=false/);
 assert.match(game,/selectedAnswer===option/);
 assert.match(game,/busyAction==="clue"/);
 assert.match(game,/busyAction==="next"/);
 assert.match(tap,/state\.pressed/);
 assert.match(tap,/scale:0\.975/);
});

test("Kids reveal and answer moments animate without extra backend operations",()=>{
 const game=source("app/game.tsx");
 assert.match(game,/Animated\.spring\(motion/);
 assert.match(game,/useNativeDriver:true/);
 assert.match(game,/focusClue\.current=next\.clueIndex/);
 assert.match(game,/scrollRef\.current\?\.scrollTo/);
 assert.match(game,/result\?<PopIn>/);
 assert.match(game,/onSubmitEditing=/);
});

test("Kids tab catalog shares child-scoped first-page cache and in-flight requests",()=>{
 const catalog=source("src/useKidsAdventures.ts");
 assert.match(catalog,/keyFor\(token:string,locale:string\)/);
 assert.match(catalog,/CACHE_MS=60_000/);
 assert.match(catalog,/inFlight\.get\(key\)/);
 assert.match(catalog,/initialCache\.set\(key/);
 assert.match(catalog,/if\(!token\|\|time\.status!=="allowed"\)/);
});

test("Kids game cards use navigation tap guards on Home, Explore, and Challenge",()=>{
 const hook=source("src/useKidsNavigation.ts");
 assert.match(hook,/if\(navigating\.current\)return/);
 for(const path of ["app/(tabs)/index.tsx","app/(tabs)/explore.tsx","app/(tabs)/challenge.tsx"]){
  const tab=source(path);
  assert.match(tab,/useKidsNavigation\(/,path);
  assert.doesNotMatch(tab,/router\.push\(/,path);
  assert.match(tab,/<KidsTap\b/,path);
 }
});
