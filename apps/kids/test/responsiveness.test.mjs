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
 assert.match(game,/result\?<PopIn celebrate=\{result\.correct\}/);
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

test("Kids feedback sounds are tiny bundled offline WAV files",()=>{
 const game=source("app/game.tsx");
 assert.match(game,/useAudioPlayer\(require\("\.\.\/assets\/feedback-success\.wav"\)/);
 assert.match(game,/playCue\(clueCue\)/);
 assert.match(game,/playCue\(v\.correct\?successCue:retryCue\)/);
 for(const name of ["feedback-success.wav","feedback-clue.wav","feedback-try-again.wav"]){
  const wav=readFileSync(new URL("../assets/"+name,import.meta.url));
  assert.equal(wav.toString("ascii",0,4),"RIFF");
  assert.equal(wav.toString("ascii",8,12),"WAVE");
  assert.equal(wav.toString("ascii",36,40),"data");
  assert.equal(wav.readUInt32LE(4),wav.length-8);
  assert.equal(wav.readUInt32LE(40),wav.length-44);
  assert.equal(wav.readUInt16LE(34),8);
  assert.ok(wav.length<5000);
 }
});
