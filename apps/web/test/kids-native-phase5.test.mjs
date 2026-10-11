import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync,existsSync } from "node:fs";
const file=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const exists=path=>existsSync(new URL("../"+path,import.meta.url));

test("no retired web Kids shell, games, parent UI or cookie-activation endpoint remains",()=>{
 for(const path of [
  "app/(platform)/kids/layout.tsx","app/(platform)/kids/page.tsx",
  "app/(platform)/kids/kids.css","app/(platform)/kids/explore/page.tsx",
  "app/(platform)/kids/explore/kids-gallery.tsx","app/(platform)/kids/challenge/page.tsx",
  "app/(platform)/kids/treasures/page.tsx","app/(platform)/kids/parent/page.tsx",
  "app/(platform)/kids/parent/guardian-panel.tsx","app/(platform)/kids/exit/page.tsx",
  "app/(platform)/kids/exit/kids-exit-form.tsx",
  "app/api/kids/device/route.ts","app/api/kids/parent/route.ts",
  "src/modules/kids/navigation.ts"
 ])assert.equal(exists(path),false,path);
});
test("retired web paths redirect to account pairing without exposing a web game",()=>{
 const edge=file("proxy.ts"),root=file("app/layout.tsx");
 assert.match(edge,/const retired=\(path:string\)=>path==="\/kids"/);
 assert.ok(edge.includes('url.pathname="/"+locale+"/account/kids"'));
 assert.match(edge,/const LEGACY_GATE="\/account\/kids\/legacy-unlock"/);
 assert.match(edge,/if\(locked && resolvedPath!==LEGACY_GATE\)/);
 assert.doesNotMatch(edge,/x-quizdip-shell", isKidsPath/);
 assert.doesNotMatch(root,/kidsShell|\{ href: "\/kids"/);
 assert.match(root,/lockedLegacyBrowser/);
 assert.doesNotMatch(file("src/i18n/messages.ts"),/nav\.kids/);
});
test("parent bootstrap is in the signed-in adult account and native shows its new URL",()=>{
 const page=file("app/account/kids/page.tsx");
 const portal=file("app/account/kids/family-settings.tsx");
 const api=file("app/api/account/kids/route.ts");
 const native=file("../kids/app/setup.tsx");
 assert.match(page,/auth\.api\.getSession/);
 assert.match(portal,/native_pair_issue/);
 assert.match(portal,/\/api\/account\/kids/);
 assert.doesNotMatch(portal,/\/api\/kids\/device|location\.assign\(localizeHref\("\/kids"/);
 assert.match(api,/requireSameOrigin\(request\)/);
 assert.match(api,/requireActor\(await actorFor\(request\)\)/);
 assert.match(api,/kid_reauth_required/);
 assert.match(api,/issueNativePairTicket/);
 assert.ok(native.includes('locale+"/account/kids"'));
});
test("old child cookies remain locked until guardian PIN; data cutover revokes WEB only",()=>{
 const legacy=file("app/api/account/kids/legacy-unlock/route.ts");
 const edge=file("proxy.ts"),auth=file("src/modules/platform/auth.ts");
 const rest=file("app/api/v1/[...segments]/route.ts");
 const sql=file("../../prisma/migrations/20261012230000_retire_web_kids_sessions/migration.sql");
 assert.match(sql,/WHERE "clientKind" = 'WEB'/);
 assert.match(sql,/"revokedAt" IS NULL/);
 assert.doesNotMatch(sql,/DELETE FROM|WHERE "clientKind" = 'NATIVE'/);
 assert.match(legacy,/device\.clientKind!=="WEB"/);
 assert.match(legacy,/await checkGuardianPin\(device.guardianId,pin\)/);
 assert.match(legacy,/Max-Age=0/);
 assert.match(legacy,/requireSameOrigin\(request\)/);
 assert.match(edge,/const locked=request.cookies.has\(KIDS_COOKIE\)/);
 assert.match(auth,/hasKidCookie/);
 assert.match(rest,/legacy_kid_retired/);
 assert.doesNotMatch(rest,/currentKidDevice/);
});
test("native protected endpoints, shared safety logic and content lane are not retired",()=>{
 for(const path of [
  "app/api/kids/native/route.ts","app/api/kids/native/play/route.ts",
  "app/api/kids/native/parent/route.ts","app/api/kids/native/time/route.ts",
  "src/modules/kids/game.ts","src/modules/kids/parent-native.ts",
  "src/modules/kids/time.ts","src/modules/platform/quiz.ts",
  "../../prisma/schema.prisma"
 ])assert.equal(exists(path),true,path);
 const service=file("src/modules/kids/service.ts");
 assert.match(service,/export async function nativeKidFromHeaders/);
 assert.match(service,/clientKind:"NATIVE"/);
 assert.doesNotMatch(service,/activateKidDevice\(|exitKidDevice\(|currentKidDevice\(/);
});
