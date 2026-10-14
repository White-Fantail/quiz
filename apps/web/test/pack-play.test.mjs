import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseOperation,operations} from "../src/modules/platform/contracts.ts";
import {runTargetCount,completesRun} from "../src/modules/platform/run-length.ts";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const id="94f0792a-18e6-40c0-a480-0be6d46dbb37";
test("pack mode requires an id in the service and preserves variable play length",()=>{
 const req=parseOperation("run_start",{mode:"PACK",packId:id,locale:"ko",lane:"GENERAL"});
 assert.equal(req.packId,id);
 assert.equal(req.mode,"PACK");
 assert.equal(req.restart,false);
 assert.throws(()=>parseOperation("run_start",{mode:"PACK",packId:"bad"}));
 assert.equal(runTargetCount({mode:"PACK",targetCount:30}),30);
 assert.equal(completesRun({mode:"PACK",targetCount:30,currentIndex:28}),false);
 assert.equal(completesRun({mode:"PACK",targetCount:30,currentIndex:29}),true);
 assert.equal(completesRun({mode:"RANDOM_FIVE",currentIndex:4}),true);
 assert.equal(runTargetCount({mode:"INFINITE"}),null);
});
test("REST and MCP expose public details and pinned pack-run playback",()=>{
 assert.equal(operations.pack_get.public,true);
 const routes=read("app/api/v1/[...segments]/route.ts");
 for(const operation of ["pack_get","pack_list","run_start","run_current"])
   assert.match(routes,new RegExp('op:\\s*"'+operation+'"'));
 const runs=read("src/modules/platform/runs.ts");
 assert.match(runs,/async function startPackRun/);
 assert.match(runs,/packVersion:pack.currentVersion,targetCount:ids.length/);
 assert.match(runs,/pinned\.get\(item\.quizId\)/);
 assert.match(runs,/mode:"PACK"/);
 assert.match(runs,/userId:actor\.id/);
 assert.match(runs,/runToken:authToken\(active\.id,actor\.id\),resumed:true/);
 assert.match(runs,/pack_kids_unavailable/);
 assert.match(runs,/pack_media_unavailable/);
 assert.match(runs,/mode==="PACK"\?100:5/);
 const schema=read("../../prisma/schema.prisma");
 assert.match(schema,/packVersion Int\?/);
 assert.match(schema,/currentVersion\s+Int\s+@default\(1\)/);
});
test("public pack links do not expose answers and the shared player supports resume",()=>{
 const pack=read("src/modules/platform/social.ts");
 assert.match(pack,/export async function packGet/);
 assert.match(pack,/playableQuizWhere\(locale\)/);
 assert.doesNotMatch(pack.slice(pack.indexOf("export async function packGet")),/answer:/);
 const player=read("app/(platform)/play/page.tsx");
 assert.match(player,/sessionStorage\.setItem\("quizdip-pack-run:/);
 assert.match(player,/localBundleRef/);
 assert.match(player,/syncLocal/);
 assert.match(player,/start\("PACK",true\)/);
 assert.match(player,/run\.mode!=="PACK"/);
 assert.match(read("src/modules/platform/play.ts"),/run\.mode==="PACK"/);
 assert.match(read("app/(platform)/packs/[packId]/play/page.tsx"),/packId=\{packId\}/);
 assert.match(read("app/(platform)/discover/page.tsx"),/PackSpotlight/);
 assert.match(read("app/(platform)/discover/pack-spotlight.tsx"),/\/packs\//);
});

test("pack play opens directly without a second start screen and preserves guest recovery",()=>{
 const detail=read("app/(platform)/packs/[packId]/page.tsx");
 const play=read("app/(platform)/play/page.tsx");
 assert.match(detail,/localizeHref\("\/packs\/"\+pack\.id\+"\/play",locale\)/);
 assert.match(play,/const \[packStartStatus,setPackStartStatus\]=useState/);
 assert.match(play,/if\(packStartKeyRef\.current===key\)return;/);
 assert.match(play,/void bootPack\(key\);/);
 assert.match(play,/const raw=sessionStorage\.getItem\(storageKey\);/);
 assert.match(play,/if\(saved\)\{[\s\S]*?await showRound\(saved\);/);
 assert.match(play,/const started=await api\("\/runs","POST"/);
 assert.match(play,/await showRound\(started\);/);
 assert.match(play,/packStartStatus==="loading"/);
 assert.match(play,/packStartStatus==="error"/);
 assert.match(play,/run&&\(!packId\|\|packStartStatus==="ready"\)/);
 assert.doesNotMatch(play,/Start or resume pack →/);
 assert.match(play,/onClick=>\(\)=>void start\("RANDOM_FIVE"\)/);
 assert.match(play,/onClick=>\(\)=>void start\("INFINITE"\)/);
 // A failed resume must not clear sessionStorage silently.
 const boot=play.slice(play.indexOf("const bootPack="),play.indexOf("  async function start("));
 assert.doesNotMatch(boot,/sessionStorage\.removeItem/);
 // Restart is always a separate, explicitly user-triggered action.
 assert.match(play,/onClick=\{\(\)=>\{[\s\S]*?sessionStorage\.removeItem\("quizdip-pack-run:/);
 assert.match(play,/void bootPack\(packId\+":"\+locale,true\)/);
});
