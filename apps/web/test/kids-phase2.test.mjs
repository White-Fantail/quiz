import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KIDS_COOKIE,hashPin,checkPin,newDeviceToken,tokenHash,readCookie,validPin,hasKidCookie } from "../src/modules/kids/credentials.ts";
import { MESSAGES } from "../src/i18n/messages.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("guardian PINs require exactly six digits, are salted and verified in constant time",()=>{
  assert.equal(validPin("123456"),true);
  for(const invalid of ["0000","1234567","abc123",123456,"12 456"])
    assert.equal(validPin(invalid),false);
  const a=hashPin("123456"),b=hashPin("123456");
  assert.notEqual(a,b);
  assert.equal(checkPin("123456",a),true);
  assert.equal(checkPin("123457",a),false);
  assert.equal(checkPin("123456","not-a-real-hash"),false);
});
test("Kids session is opaque, HTTP cookie parsed narrowly and stored by hash",()=>{
  const token=newDeviceToken(),next=newDeviceToken();
  assert.notEqual(token,next);
  assert.equal(tokenHash(token).length,64);
  assert.notEqual(tokenHash(token),token);
  assert.equal(readCookie("abc=z; "+KIDS_COOKIE+"="+token+"; foo=bar"),token);
  assert.equal(readCookie(KIDS_COOKIE+"=forged"),null);
  assert.equal(hasKidCookie(KIDS_COOKIE+"=forged"),true);
});
test("child authorization denies adult navigation, auth routes and general REST operations",()=>{
  const proxy=read("proxy.ts"),root=read("app/(platform)/kids/layout.tsx"),
    auth=read("src/modules/platform/auth.ts"),rest=read("app/api/v1/[...segments]/route.ts"),
    authApi=read("app/api/auth/[...all]/route.ts");
  assert.match(proxy,/locked && !isKidsPath\(resolvedPath\)/);
  assert.match(proxy,/KIDS_COOKIE/);
  assert.match(root,/currentKidDevice/);
  assert.match(root,/redirect\(localizeHref\("\/kids\/exit"/);
  assert.match(auth,/hasKidCookie\(request\.headers\.get\("cookie"\)\)/);
  assert.match(rest,/currentKidDevice\(request\.headers\)/);
  assert.match(rest,/\["quiz_list","topic_list"\]/);
  assert.match(rest,/body\.kids !== true \|\| body\.mine === true \|\| body\.locale !== kid\.profile\.locale/);
  assert.match(authApi,/kid_mode_active/);
});
test("profiles and devices require trusted guardian ownership and PIN guard",()=>{
  const service=read("src/modules/kids/service.ts"),api=read("app/api/kids/device/route.ts"),
    parent=read("app/api/kids/parent/route.ts"),migration=read("../../prisma/migrations/20261012150000_kids_guardian_sessions/migration.sql");
  assert.match(service,/where:\{id,guardianId\}/);
  assert.match(service,/where:\{id,guardianId,revokedAt:null\}/);
  assert.match(service,/checkGuardianPin\(guardianId,pin\)/);
  assert.match(service,/kidProfile\.deleteMany/);
  assert.match(service,/5\*60000/);
  assert.match(api,/HttpOnly; SameSite=Lax/);
  assert.match(api,/await exitKidDevice\(token,p\.pin\)/);
  assert.match(parent,/kid_reauth_required/);
  assert.match(migration,/CREATE TABLE "KidGuardianPin"/);
  assert.match(migration,/CREATE UNIQUE INDEX "KidDeviceSession_tokenHash_key"/);
  assert.match(migration,/ON DELETE CASCADE/);
});
test("all new guardian UI labels exist in each language",()=>{
  for(const [key,en] of Object.entries(MESSAGES.en)){
    if(!key.startsWith("kids.guardian.")&&!key.startsWith("kids.exit."))continue;
    assert.ok(en.trim());
    assert.ok(MESSAGES.ko[key]?.trim(),key);
  }
  assert.match(read("app/(platform)/kids/parent/guardian-panel.tsx"),/useTranslation/);
  assert.match(read("app/(platform)/kids/exit/kids-exit-form.tsx"),/useTranslation/);
});
