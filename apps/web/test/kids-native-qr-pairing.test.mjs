import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
 createNativePairSecrets,devicePairHash,qrPairHash,shortPairHash
} from "../src/modules/kids/credentials.ts";

const source=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("QR approval token, six-digit code and private device claimant are distinct",()=>{
 const first=createNativePairSecrets(),second=createNativePairSecrets();
 assert.match(first.deviceSecret,/^[A-Za-z0-9_-]{40,90}$/);
 assert.match(first.qrToken,/^[A-Za-z0-9_-]{24}$/);
 assert.match(first.shortCode,/^[0-9]{6}$/);
 assert.notEqual(first.deviceSecret,second.deviceSecret);
 assert.notEqual(first.qrToken,second.qrToken);
 assert.equal(devicePairHash(first.deviceSecret).length,64);
 assert.equal(qrPairHash(first.qrToken).length,64);
 assert.equal(shortPairHash(first.shortCode).length,64);
 assert.notEqual(devicePairHash(first.deviceSecret),qrPairHash(first.deviceSecret));
});

test("native device waits for PIN-protected parent approval; token claimed exactly once",()=>{
 const service=source("src/modules/kids/service.ts");
 const route=source("app/api/kids/native/pair/route.ts");
 const parent=source("app/api/account/kids/route.ts");
 assert.match(parent,/requireSameOrigin\(request\)/);
 assert.match(parent,/native_pair_approve/);
 assert.match(service,/await checkGuardianPin\(guardianId,pin\)/);
 assert.match(service,/pairCodeAttempts:\{increment:1\}/);
 assert.match(service,/pairCodeLockedUntil/);
 assert.match(service,/claimedAt:null,expiresAt:\{gt:now\}/);
 assert.match(service,/claimed.count!==1/);
 assert.match(service,/clientKind:"NATIVE"/);
 assert.match(route,/claimNativePairRequest/);
 assert.doesNotMatch(route,/actorFor|requireActor/);
 assert.match(route,/Cache-Control/);
});

test("QR browser URL is for parent approval only; private device claim never travels in it",()=>{
 const setup=source("../kids/app/setup.tsx");
 const client=source("../../packages/api-client/src/index.ts");
 const connect=source("app/account/kids/connect/page.tsx");
 assert.match(setup,/account\/kids\/connect\?token=/);
 assert.match(setup,/request\.qrToken/);
 assert.match(setup,/request\.shortCode/);
 assert.doesNotMatch(setup,/account\/kids\/connect\?token="\+encodeURIComponent\(request\.deviceSecret\)/);
 assert.match(client,/credentials:"omit"/);
 assert.match(connect,/auth\.api\.getSession/);
 assert.match(connect,/PairApproval qrToken=/);
});

test("migration stores only hashed references; existing long-code API survives",()=>{
 const schema=source("../../prisma/schema.prisma");
 const migration=source("../../prisma/migrations/20261012233000_kids_device_initiated_pairing/migration.sql");
 assert.match(schema,/model KidPairRequest/);
 for(const name of ["deviceSecretHash","approvalHash","shortCodeHash"]){
   assert.match(schema,new RegExp(name+"\\s+String\\s+@unique"));
   assert.match(migration,new RegExp("KidPairRequest_"+name+"_key"));
 }
 assert.match(source("app/api/kids/native/route.ts"),/redeemNativePairTicket/);
});
