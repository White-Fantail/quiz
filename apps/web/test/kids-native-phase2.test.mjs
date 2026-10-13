import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPairCode,normalizePairCode,pairCodeHash,tokenHash } from "../src/modules/kids/credentials.ts";

const file=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("pairing codes use cryptographic random bytes and never persist raw values",()=>{
 const a=createPairCode(),b=createPairCode();
 assert.notEqual(a,b);
 assert.match(a,/^[A-F0-9]{6}(?:-[A-F0-9]{6}){3}$/);
 const normalized=normalizePairCode(a);
 assert.equal(normalized?.length,24);
 assert.equal(normalizePairCode(a.toLowerCase()),normalized);
 assert.equal(normalizePairCode("wrong code"),null);
 assert.equal(pairCodeHash(normalized).length,64);
 assert.notEqual(pairCodeHash(normalized),normalized);
 assert.notEqual(pairCodeHash(normalized),tokenHash(normalized));
});
test("database migration preserves existing web sessions while adding isolated native ones",()=>{
 const sql=file("../../prisma/migrations/20261012190000_kids_native_pairing/migration.sql");
 assert.match(sql,/clientKind.*DEFAULT 'WEB'/);
 assert.match(sql,/KidPairTicket_codeHash_key/);
 assert.match(sql,/REFERENCES "KidProfile"/);
 assert.match(sql,/REFERENCES "User"/);
 const schema=file("../../prisma/schema.prisma");
 assert.match(schema,/model KidPairTicket/);
 assert.match(schema,/clientKind\s+String\s+@default\("WEB"\)/);
});
test("native code issuance needs browser-auth guardian and PIN, uses one-time expiry",()=>{
 const parent=file("app/api/account/kids/route.ts"),service=file("src/modules/kids/service.ts");
 assert.match(parent,/actorFor\(request\)/);
 assert.match(parent,/requireSameOrigin\(request\)/);
 assert.match(parent,/native_pair_issue/);
 assert.match(service,/await checkGuardianPin\(guardianId, pin\)/);
 assert.match(service,/consumedAt:null,expiresAt:\{gt:now\}/);
 assert.match(service,/claimed.count !== 1/);
 assert.match(service,/clientKind:"NATIVE"/);
 assert.match(service,/guardianId!==ticket.profile.guardianId/);
 assert.match(service,/clientKind:"NATIVE",revokedAt:null/);
});
test("native device route is separate from adult auth, validates scope and language",()=>{
 const native=file("app/api/kids/native/route.ts");
 const auth=file("src/modules/platform/auth.ts");
 assert.match(native,/nativeKidFromHeaders\(request.headers\)/);
 assert.match(native,/kid_locale_locked/);
 assert.match(native,/execute\("quiz_list"/);
 assert.match(native,/kids:true,locale:kid.profile.locale/);
 assert.doesNotMatch(native,/actorFor\(request\)/);
 assert.match(auth,/if \(request.headers.has\("authorization"\)\)/);
 const service=file("src/modules/kids/service.ts");
 assert.match(service,/session.clientKind!=="NATIVE"/);
 assert.match(service,/session.expiresAt.getTime\(\)<=Date.now\(\)/);
 assert.match(service,/await checkGuardianPin\(guardianId,pin\)/);
});
test("native UI guards route and secure storage and uses parent-approved locale",()=>{
 const shell=file("../kids/app/(tabs)/_layout.tsx");
 const state=file("../kids/src/state/session.tsx");
 const catalog=file("../kids/app/(tabs)/explore.tsx");
 assert.match(shell,/status!=="active"/);
 assert.match(state,/expo-secure-store/);
 assert.match(state,/SecureStore.getItemAsync/);
 assert.match(state,/SecureStore.deleteItemAsync/);
 assert.match(state,/AppState.addEventListener/);
 assert.match(catalog,/useKidsAdventures/);
 assert.match(file("../kids/src/useKidsAdventures.ts"),/kidsApi\.catalog\(token/);
 assert.doesNotMatch(catalog,/publicApi\.kidsCatalog/);
});
