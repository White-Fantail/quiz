import { createNativePairSecrets, devicePairHash, qrPairHash, shortPairHash } from "./credentials";
import { db } from "../platform/db";
import { fail } from "../platform/auth";
import { checkPin, hashPin, newDeviceToken, tokenHash, MAX_DEVICE_AGE_SECONDS, createPairCode, normalizePairCode, pairCodeHash } from "./credentials";
import type { Locale } from "../../i18n/core";

export type KidAgeBand = "EARLY" | "MIDDLE" | "OLDER";
export type KidProfileInput = { nickname:string; ageBand: KidAgeBand; locale: Locale; sessionMinutes:number;
 dailyMinutes?:number;playSessionMinutes?:number;breakEveryMinutes?:number;timeZone?:string };

export async function findKidDevice(token: string | null) {
  if (!token) return null;
  return db().kidDeviceSession.findUnique({
    where:{tokenHash:tokenHash(token)},
    include:{profile:true}
  });
}

/** Prevent offline guessing and PIN sharing between guardians. DB lockout survives restarts. */
export async function checkGuardianPin(guardianId: string, pin: string) {
  const record = await db().kidGuardianPin.findUnique({where:{guardianId}});
  if (!record) fail(409,"kid_pin_unset","Set a guardian PIN first");
  if (record.lockedUntil && record.lockedUntil.getTime() > Date.now())
    fail(429,"kid_pin_locked","Too many attempts; try again later");
  const afterCooldown = !!record.lockedUntil && record.lockedUntil.getTime() <= Date.now();
  if (afterCooldown) {
    await db().kidGuardianPin.update({where:{guardianId},data:{attempts:0,lockedUntil:null}});
  }
  if (!checkPin(pin,record.hash)) {
    // Read the atomic increment's returned count; a stale pre-increment snapshot
    // would let multiple parallel wrong PINs escape the five-try lockout.
    const updated = await db().kidGuardianPin.update({
      where:{guardianId},data:{attempts:{increment:1}}
    });
    if(updated.attempts >= 5) {
      await db().kidGuardianPin.update({where:{guardianId},
        data:{lockedUntil:new Date(Date.now()+5*60000)}});
    }
    fail(updated.attempts >= 5 ? 429 : 403,
      updated.attempts >= 5 ? "kid_pin_locked" : "kid_pin_invalid",
      updated.attempts >= 5 ? "Too many attempts; try again later" : "Incorrect guardian PIN");
  }
  await db().kidGuardianPin.update({where:{guardianId},data:{attempts:0,lockedUntil:null}});
}
export async function guardianOverview(guardianId:string) {
  const [pin,profiles,devices] = await Promise.all([
    db().kidGuardianPin.findUnique({where:{guardianId},select:{guardianId:true}}),
    db().kidProfile.findMany({where:{guardianId},orderBy:{createdAt:"asc"},select:{
      id:true,nickname:true,ageBand:true,locale:true,sessionMinutes:true,dailyMinutes:true,playSessionMinutes:true,breakEveryMinutes:true,timeZone:true,createdAt:true
    }}),
    db().kidDeviceSession.findMany({where:{guardianId,revokedAt:null,expiresAt:{gt:new Date()}},orderBy:{createdAt:"desc"},select:{
      id:true,profileId:true,deviceName:true,createdAt:true,expiresAt:true
    }})
  ]);
  return {pinConfigured:!!pin,profiles,devices};
}
export async function addKidProfile(guardianId:string,input:KidProfileInput) {
  if (await db().kidProfile.count({where:{guardianId}}) >= 8)
    fail(409,"kid_profile_limit","At most eight child profiles are supported");
  return db().kidProfile.create({data:{
    guardianId,nickname:input.nickname,ageBand:input.ageBand,locale:input.locale,sessionMinutes:input.sessionMinutes,
    ...(input.dailyMinutes!==undefined?{dailyMinutes:input.dailyMinutes}:{}),
    ...(input.playSessionMinutes!==undefined?{playSessionMinutes:input.playSessionMinutes}:{}),
    ...(input.breakEveryMinutes!==undefined?{breakEveryMinutes:input.breakEveryMinutes}:{}),
    ...(input.timeZone?{timeZone:input.timeZone}:{})
  },select:{
    id:true,nickname:true,ageBand:true,locale:true,sessionMinutes:true
  }});
}
export async function updateKidProfile(guardianId:string,id:string,input:KidProfileInput) {
  const original=await db().kidProfile.findFirst({where:{id,guardianId}});
  if(!original)fail(404,"kid_profile_missing","Child profile not found");
  const updated=await db().kidProfile.updateMany({where:{id,guardianId},data:{
    nickname:input.nickname,ageBand:input.ageBand,locale:input.locale,sessionMinutes:input.sessionMinutes,
    ...(input.dailyMinutes!==undefined?{dailyMinutes:input.dailyMinutes}:{}),
    ...(input.playSessionMinutes!==undefined?{playSessionMinutes:input.playSessionMinutes}:{}),
    ...(input.breakEveryMinutes!==undefined?{breakEveryMinutes:input.breakEveryMinutes}:{}),
    ...(input.timeZone?{timeZone:input.timeZone}:{})
  }});
  if(!updated.count)fail(404,"kid_profile_missing","Child profile not found");
  // Only content language or age changes invalidate pairing; time budgets are live
  // from the server and do not silently extend the device's native credential expiry.
  const devicesRevoked=original.locale!==input.locale || original.ageBand!==input.ageBand;
  if(devicesRevoked)await db().kidDeviceSession.updateMany({
    where:{guardianId,profileId:id,revokedAt:null},data:{revokedAt:new Date()}});
  return {updated:true,devicesRevoked};
}
export async function deleteKidProfile(guardianId:string,id:string) {
  // Remove private play history as well as the profile; cascading only the
  // KidPlayRun link would leave orphaned anonymous scores and session records.
  const deleted=await db().$transaction(async tx => {
    const profile=await tx.kidProfile.findFirst({where:{id,guardianId},select:{id:true}});
    if(!profile)return false;
    const [runs,singles]=await Promise.all([
      tx.kidPlayRun.findMany({where:{profileId:id},select:{runId:true}}),
      tx.kidPlaySingle.findMany({where:{profileId:id},select:{sessionId:true}})
    ]);
    const runIds=runs.map(x=>x.runId),singleIds=singles.map(x=>x.sessionId);
    await tx.kidPlaySingle.deleteMany({where:{profileId:id}});
    await tx.kidPlayRun.deleteMany({where:{profileId:id}});
    if(runIds.length || singleIds.length){
      await tx.playSession.deleteMany({where:{OR:[
        {runId:{in:runIds}},{id:{in:singleIds}}
      ]}});
      await tx.playRunQuestion.deleteMany({where:{runId:{in:runIds}}});
      await tx.playRun.deleteMany({where:{id:{in:runIds}}});
    }
    const result=await tx.kidProfile.deleteMany({where:{id,guardianId}});
    return result.count>0;
  });
  if (!deleted) fail(404,"kid_profile_missing","Child profile not found");
  return {deleted:true};
}
export async function revokeKidDevice(guardianId:string,id:string) {
  const updated=await db().kidDeviceSession.updateMany({
    where:{id,guardianId,revokedAt:null},data:{revokedAt:new Date()}
  });
  if(!updated.count) fail(404,"kid_device_missing","Active device not found");
  return {revoked:true};
}
export async function setGuardianPin(guardianId:string,pin:string,previous?:string,allowReset=false) {
  const current=await db().kidGuardianPin.findUnique({where:{guardianId}});
  if (current && !allowReset) {
    if (!previous) fail(403,"kid_pin_required","Current PIN required");
    await checkGuardianPin(guardianId,previous);
  }
  const hash=hashPin(pin);
  await db().kidGuardianPin.upsert({where:{guardianId},create:{guardianId,hash},update:{
    hash,attempts:0,lockedUntil:null
  }});
  if(current) {
    const now=new Date();
    await Promise.all([
      db().kidDeviceSession.updateMany({where:{guardianId,clientKind:"NATIVE",revokedAt:null},data:{revokedAt:now}}),
      db().kidPairTicket.updateMany({where:{guardianId,consumedAt:null},data:{consumedAt:now}})
    ]);
  }
  return {pinConfigured:true};
}
/** Authorize one native device after a trusted signed-in guardian verifies their PIN. */
export async function issueNativePairTicket(guardianId: string, profileId: string, pin: string) {
  await checkGuardianPin(guardianId, pin);
  const profile = await db().kidProfile.findFirst({where:{id:profileId,guardianId}});
  if (!profile) fail(404,"kid_profile_missing","Child profile does not belong to this guardian");
  const now = new Date();
  const [activeDevices,pending] = await Promise.all([
    db().kidDeviceSession.count({where:{guardianId,revokedAt:null,expiresAt:{gt:now}}}),
    db().kidPairTicket.count({where:{guardianId,consumedAt:null,expiresAt:{gt:now}}})
  ]);
  if(activeDevices >= 10) fail(409,"kid_device_limit","At most ten active child devices");
  if(pending >= 3) fail(429,"kid_pair_limit","Too many active pairing tickets");
  const code = createPairCode();
  const expiresAt = new Date(Date.now()+5*60*1000);
  await db().kidPairTicket.create({data:{guardianId,profileId,codeHash:pairCodeHash(normalizePairCode(code)!),expiresAt}});
  return {code,expiresAt:expiresAt.toISOString()};
}

/** A ticket is claimed atomically; parallel replays cannot issue another device token. */
export async function redeemNativePairTicket(codeInput: string, deviceName: string) {
  const normalized = normalizePairCode(codeInput);
  if(!normalized) fail(400,"invalid_pair_code","Invalid pairing code format");
  const codeHash = pairCodeHash(normalized);
  const token = newDeviceToken();
  const now = new Date();
  return db().$transaction(async tx => {
    const claimed = await tx.kidPairTicket.updateMany({
      where:{codeHash,consumedAt:null,expiresAt:{gt:now}},
      data:{consumedAt:now}
    });
    if(claimed.count !== 1) fail(403,"pair_unavailable","Pairing code invalid, used, or expired");
    const ticket = await tx.kidPairTicket.findUnique({where:{codeHash},include:{profile:true}});
    if(!ticket || ticket.guardianId!==ticket.profile.guardianId)
      fail(403,"pair_unavailable","Invalid pairing guardian");
    const active = await tx.kidDeviceSession.count({where:{
      guardianId:ticket.guardianId,revokedAt:null,expiresAt:{gt:now}
    }});
    if(active >= 10) fail(409,"kid_device_limit","At most ten active child devices");
    const expiresAt=new Date(Date.now()+MAX_DEVICE_AGE_SECONDS*1000);
    await tx.kidDeviceSession.create({data:{
      guardianId:ticket.guardianId,profileId:ticket.profileId,
      clientKind:"NATIVE",tokenHash:tokenHash(token),deviceName,expiresAt
    }});
    return {token,expiresAt:expiresAt.toISOString(),profile:{
      nickname:ticket.profile.nickname,ageBand:ticket.profile.ageBand,locale:ticket.profile.locale
    }};
  });
}

/** Native credentials have an isolated scope. Never interpret web device cookies or guardian login here. */
export async function nativeKidFromHeaders(headers: Headers) {
  const auth = headers.get("authorization");
  const match = auth?.match(/^Bearer ([A-Za-z0-9_-]{40,90})$/);
  if(!match) fail(401,"native_auth_required","Native child device credential required");
  const session = await findKidDevice(match[1]);
  if(!session || session.clientKind!=="NATIVE" || session.revokedAt ||
      session.expiresAt.getTime()<=Date.now() || session.guardianId!==session.profile.guardianId)
    fail(401,"native_session_invalid","Native device authorization expired or revoked");
  return session;
}
export async function releaseNativeKidDevice(sessionId: string, guardianId: string, pin: string) {
  await checkGuardianPin(guardianId,pin);
  const result=await db().kidDeviceSession.updateMany({where:{
    id:sessionId,guardianId,clientKind:"NATIVE",revokedAt:null
  },data:{revokedAt:new Date()}});
  if(!result.count) fail(401,"native_session_invalid","Device already revoked");
  return {unlocked:true};
}

/** A child device starts a request before there is any parent/child identity attached. */
export async function startNativePairRequest(deviceName:string) {
  const expiresAt=new Date(Date.now()+5*60*1000);
  for(let attempt=0;attempt<5;attempt++) {
    const secrets=createNativePairSecrets();
    try {
      await db().kidPairRequest.create({data:{
        deviceSecretHash:devicePairHash(secrets.deviceSecret),
        approvalHash:qrPairHash(secrets.qrToken),
        shortCodeHash:shortPairHash(secrets.shortCode),
        deviceName,expiresAt
      }});
      return {...secrets,expiresAt:expiresAt.toISOString()};
    }catch(e) {
      if((e as {code?:string})?.code!=="P2002") throw e;
    }
  }
  fail(503,"pair_busy","Please try creating the pairing code again");
}

/** Device poller has a 256-bit secret never included in the QR or browser URL. */
export async function claimNativePairRequest(secret:string) {
  if(!/^[A-Za-z0-9_-]{40,90}$/.test(secret))
    fail(400,"invalid_pair_secret","Invalid device pairing request");
  const now=new Date();
  const deviceSecretHash=devicePairHash(secret);
  return db().$transaction(async tx=>{
    const request=await tx.kidPairRequest.findUnique({where:{deviceSecretHash}});
    if(!request || request.expiresAt<=now)
      fail(410,"pair_expired","Pairing request expired");
    if(request.claimedAt) fail(409,"pair_claimed","Pairing request already used");
    if(!request.approvedAt||!request.guardianId||!request.profileId)
      return {status:"pending" as const};
    const claimed=await tx.kidPairRequest.updateMany({where:{
      id:request.id,approvedAt:{not:null},claimedAt:null,expiresAt:{gt:now}
    },data:{claimedAt:now}});
    if(claimed.count!==1)fail(409,"pair_claimed","Pairing request already used");
    const profile=await tx.kidProfile.findFirst({where:{
      id:request.profileId,guardianId:request.guardianId
    }});
    if(!profile)fail(410,"pair_expired","Parent profile no longer available");
    const count=await tx.kidDeviceSession.count({where:{
      guardianId:request.guardianId,revokedAt:null,expiresAt:{gt:now}
    }});
    if(count>=10)fail(409,"kid_device_limit","At most ten active child devices");
    const token=newDeviceToken();
    const expiresAt=new Date(Date.now()+MAX_DEVICE_AGE_SECONDS*1000);
    await tx.kidDeviceSession.create({data:{
      guardianId:request.guardianId,profileId:profile.id,clientKind:"NATIVE",
      tokenHash:tokenHash(token),deviceName:request.deviceName,expiresAt
    }});
    return {status:"paired" as const,token,expiresAt:expiresAt.toISOString(),
      profile:{nickname:profile.nickname,ageBand:profile.ageBand,locale:profile.locale}};
  });
}

/** QR is high entropy; fallback has per-guardian DB rate limiting and requires PIN. */
export async function approveNativePairRequest(guardianId:string,profileId:string,pin:string,
  qrToken?:string,shortCode?:string) {
  if(Boolean(qrToken)===Boolean(shortCode))
    fail(400,"pair_input_invalid","Provide either a QR request or a six-digit code");
  if(qrToken && !/^[A-Za-z0-9_-]{24}$/.test(qrToken))
    fail(400,"pair_input_invalid","Invalid QR token");
  if(shortCode && !/^[0-9]{6}$/.test(shortCode))
    fail(400,"pair_input_invalid","Enter the six-digit code shown on the child device");
  await checkGuardianPin(guardianId,pin);
  const profile=await db().kidProfile.findFirst({where:{id:profileId,guardianId}});
  if(!profile)fail(404,"kid_profile_missing","Child profile not found");
  const now=new Date();
  if(shortCode) {
    const limiter=await db().kidGuardianPin.findUnique({where:{guardianId}});
    if(!limiter)fail(409,"kid_pin_unset","Set your guardian PIN");
    if(limiter.pairCodeLockedUntil && limiter.pairCodeLockedUntil>now)
      fail(429,"pair_code_locked","Too many code attempts; try again in five minutes");
    if(limiter.pairCodeLockedUntil && limiter.pairCodeLockedUntil<=now)
      await db().kidGuardianPin.update({where:{guardianId},data:{pairCodeAttempts:0,pairCodeLockedUntil:null}});
    const updated=await db().kidGuardianPin.update({where:{guardianId},data:{pairCodeAttempts:{increment:1}}});
    if(updated.pairCodeAttempts>=5)
      await db().kidGuardianPin.update({where:{guardianId},
        data:{pairCodeLockedUntil:new Date(now.getTime()+5*60000)}});
  }
  const where=qrToken?{approvalHash:qrPairHash(qrToken)}:{shortCodeHash:shortPairHash(shortCode!)};
  const existing=await db().kidPairRequest.findFirst({where:{
    ...where,expiresAt:{gt:now},approvedAt:null,claimedAt:null
  }});
  if(!existing)fail(403,"pair_unavailable","Pairing code expired or invalid");
  const devices=await db().kidDeviceSession.count({where:{guardianId,revokedAt:null,expiresAt:{gt:now}}});
  if(devices>=10)fail(409,"kid_device_limit","At most ten active child devices");
  const assigned=await db().kidPairRequest.updateMany({
    where:{id:existing.id,expiresAt:{gt:now},approvedAt:null,claimedAt:null},
    data:{guardianId,profileId,approvedAt:now}
  });
  if(assigned.count!==1)fail(409,"pair_unavailable","This device was already approved");
  if(shortCode)await db().kidGuardianPin.update({where:{guardianId},data:{
    pairCodeAttempts:0,pairCodeLockedUntil:null
  }});
  return {approved:true,deviceName:existing.deviceName};
}
