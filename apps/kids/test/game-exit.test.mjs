import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Kids game offers a visible leave control during loading and gameplay",()=>{
 const game=source("app/game.tsx");
 assert.match(game,/const leaveButton=<KidsTap accessibilityRole="button"/);
 assert.match(game,/accessibilityLabel=\{t\("native\.play\.leave"\)\}/);
 assert.match(game,/title=\{t\("native\.play\.loading"\)\} headerAction=\{leaveButton\}/);
 assert.match(game,/title=\{question\.title\} subtitle=\{question\.prompt\} headerAction=\{leaveButton\}/);
});

test("leaving confirms, keeps SecureStore resume, and stays inside Kids mode",()=>{
 const game=source("app/game.tsx");
 const challenge=source("app/(tabs)/challenge.tsx");
 const root=source("app/_layout.tsx");
 assert.match(game,/Alert\.alert\(t\("native\.play\.leaveTitle"\)/);
 assert.match(game,/t\(reference\?"native\.play\.leaveMessage":"native\.play\.leaveLoadingMessage"\)/);
 assert.match(game,/onPress:\(\)=>router\.replace\("\/"\)/);
 assert.match(game,/BackHandler\.addEventListener\("hardwareBackPress"/);
 assert.match(root,/name="game" options=\{\{gestureEnabled:false\}\}/);
 assert.match(game,/quizdip-kids-active-game-v1/);
 assert.match(challenge,/SecureStore\.getItemAsync\(SAVED_GAME\)/);
 assert.match(challenge,/native\.play\.resume/);
});

test("both Kids locales explain exit and resuming",()=>{
 const copy=source("../../packages/i18n/src/kids.ts");
 for(const key of ["native.play.leave","native.play.leaveTitle","native.play.leaveMessage","native.play.leaveLoadingMessage"]){
   assert.equal(copy.split('"'+key+'"').length-1,2,"translation exists in both languages: "+key);
 }
});
