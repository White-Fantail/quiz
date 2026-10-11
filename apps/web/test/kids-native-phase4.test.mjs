import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("phase four stores separate native play limits and shared minute slots",()=>{
 const schema=file("../../prisma/schema.prisma");
 const sql=file("../../prisma/migrations/20261012210000_kids_native_parent_time/migration.sql");
 for(const field of ["dailyMinutes","playSessionMinutes","breakEveryMinutes","timeZone"]){
  assert.match(schema,new RegExp(field+"\\s+"));
  assert.ok(sql.includes('ADD COLUMN "'+field+'"'));
 }
 assert.match(schema,/model KidUsageMinute/);
 assert.match(sql,/KidUsageMinute_profileId_utcMinute_key/);
 assert.match(sql,/ON DELETE CASCADE/);
 assert.match(schema,/model KidParentAccess/);
 assert.match(sql,/KidParentAccess_tokenHash_key/);
});
test("native guardian access requires a PIN and binds to original child's device",()=>{
 const admin=file("src/modules/kids/parent-native.ts");
 const route=file("app/api/kids/native/parent/route.ts");
 assert.match(admin,/await checkGuardianPin\(kid.guardianId,pin\)/);
 assert.match(admin,/deviceId:kid.id/);
 assert.match(admin,/access.guardianId!==kid.guardianId/);
 assert.match(admin,/access.deviceId!==kid.id/);
 assert.match(admin,/access.expiresAt<=new Date\(\)/);
 assert.match(route,/nativeKidFromHeaders\(request.headers\)/);
 assert.match(route,/requireParentAccess\(kid,request.headers.get\("x-kids-parent"\)\)/);
 assert.doesNotMatch(route,/actorFor\(|MCP|ADMIN/);
 assert.match(route,/profile_delete/);
 assert.match(route,/device_revoke/);
 assert.match(route,/history_delete/);
});
test("server applies time budgets to discovery, games and private treasures",()=>{
 const time=file("src/modules/kids/time.ts");
 assert.match(time,/DateTimeFormat/);
 assert.match(time,/kidUsageMinute\.count/);
 assert.match(time,/utcMinute:minute/);
 assert.match(time,/isolationLevel:"Serializable"/);
 assert.match(time,/kid_daily_limit/);
 assert.match(time,/kid_session_limit/);
 assert.match(time,/kid_break_required/);
 assert.match(time,/kid_heartbeat_required/);
 assert.match(time,/STALE_MS/);
 assert.match(time,/createdAt:\{lt:new Date\(now.getTime\(\)-90\*DAY_MS\)\}/);
 const catalog=file("app/api/kids/native/route.ts");
 const play=file("app/api/kids/native/play/route.ts");
 assert.match(catalog,/await requirePlayable\(kid\)/);
 assert.ok((play.match(/await requirePlayable\(kid\)/g)??[]).length>=2);
});
test("native shell locks offline, out-of-time and background sessions",()=>{
 const root=file("../kids/app/_layout.tsx");
 const tabs=file("../kids/app/(tabs)/_layout.tsx");
 const game=file("../kids/app/game.tsx");
 const time=file("../kids/src/state/time.tsx");
 const access=file("../kids/src/state/parent.tsx");
 assert.match(root,/KidsTimeProvider/);
 assert.match(tabs,/time.status==="blocked"/);
 assert.match(game,/time.status==="blocked"/);
 assert.match(time,/AppState.addEventListener/);
 assert.match(time,/kidsApi.time\(token,true\)/);
 assert.match(time,/HEARTBEAT_MS=45000/);
 assert.match(access,/if\(s!=="active"\)clear\(\)/);
 assert.doesNotMatch(access,/SecureStore|AsyncStorage/);
});
test("profiles are isolated and native guardian can erase child history",()=>{
 const history=file("src/modules/kids/history.ts");
 assert.match(history,/where:\{id:profileId,guardianId\}/);
 assert.match(history,/kidUsageMinute.deleteMany/);
 assert.match(history,/playSession.deleteMany/);
 const page=file("../kids/app/guardian.tsx");
 assert.match(page,/native.parent.clearHistory/);
 assert.match(page,/native.parent.deleteChild/);
 assert.match(page,/native.parent.weekly/);
 assert.match(page,/native.parent.daily/);
 assert.match(page,/native.parent.timezone/);
});
test("children's app does not request microphone, advertising or location",()=>{
 const cfg=JSON.parse(file("../kids/app.json"));
 const blocked=cfg.expo.android.blockedPermissions;
 assert.ok(blocked.includes("android.permission.RECORD_AUDIO"));
 assert.ok(blocked.includes("android.permission.ACCESS_FINE_LOCATION"));
 assert.ok(blocked.includes("com.google.android.gms.permission.AD_ID"));
 const setup=file("../kids/app/setup.tsx");
 assert.doesNotMatch(setup,/Linking.openURL/);
});
