import { db } from "../platform/db";
import { fail } from "../platform/auth";
import { checkPin, hashPin, newDeviceToken, tokenHash, readCookie, MAX_DEVICE_AGE_SECONDS } from "./credentials";
import type { Locale } from "../../i18n/core";

export type KidAgeBand = "EARLY" | "MIDDLE" | "OLDER";
export type KidProfileInput = { nickname:string; ageBand: KidAgeBand; locale: Locale; sessionMinutes:number };
export function kidTokenFromHeaders(headers: Headers): string | null { return readCookie(headers.get("cookie")); }

export async function findKidDevice(token: string | null) {
  if (!token) return null;
  return db().kidDeviceSession.findUnique({
    where:{tokenHash:tokenHash(token)},
    include:{profile:true}
  });
}

export async function currentKidDevice(headers: Headers) {
  const device = await findKidDevice(kidTokenFromHeaders(headers));
  if (!device || device.revokedAt || device.expiresAt.getTime() <= Date.now()) return null;
  return device;
}

export function kidSessionDeadline(minutes: number, started = Date.now()): Date {
  return new Date(started + (minutes ? minutes * 60000 : MAX_DEVICE_AGE_SECONDS * 1000));
}

/** Prevent offline guessing and PIN sharing between guardians. DB lockout survives restarts. */
export async function checkGuardianPin(guardianId: string, pin: string) {
  const record = await db().kidGuardianPin.findUnique({where:{guardianId}});
  if (!record) fail(409,"kid_pin_unset","Set a guardian PIN first");
  if (record.lockedUntil && record.lockedUntil.getTime() > Date.now())
    fail(429,"kid_pin_locked","Too many attempts; try again later");
  if (!checkPin(pin,record.hash)) {
    const attempts = record.attempts + 1;
    // Atomic increment avoids losing concurrent guesses; lockout is checked on every request.
    await db().kidGuardianPin.update({
      where:{guardianId},
      data:{attempts:{increment:1}, ...(attempts >= 5 ? {lockedUntil:new Date(Date.now()+5*60000)} : {})}
    });
    fail(403,"kid_pin_invalid","Incorrect guardian PIN");
  }
  await db().kidGuardianPin.update({where:{guardianId},data:{attempts:0,lockedUntil:null}});
}
export async function guardianOverview(guardianId:string) {
  const [pin,profiles,devices] = await Promise.all([
    db().kidGuardianPin.findUnique({where:{guardianId},select:{guardianId:true}}),
    db().kidProfile.findMany({where:{guardianId},orderBy:{createdAt:"asc"},select:{
      id:true,nickname:true,ageBand:true,locale:true,sessionMinutes:true,createdAt:true
    }}),
    db().kidDeviceSession.findMany({where:{guardianId,revokedAt:null},orderBy:{createdAt:"desc"},select:{
      id:true,profileId:true,deviceName:true,createdAt:true,expiresAt:true
    }})
  ]);
  return {pinConfigured:!!pin,profiles,devices};
}
export async function addKidProfile(guardianId:string,input:KidProfileInput) {
  if (await db().kidProfile.count({where:{guardianId}}) >= 8)
    fail(409,"kid_profile_limit","At most eight child profiles are supported");
  return db().kidProfile.create({data:{
    guardianId,nickname:input.nickname,ageBand:input.ageBand,locale:input.locale,sessionMinutes:input.sessionMinutes
  },select:{
    id:true,nickname:true,ageBand:true,locale:true,sessionMinutes:true
  }});
}
export async function updateKidProfile(guardianId:string,id:string,input:KidProfileInput) {
  const updated=await db().kidProfile.updateMany({where:{id,guardianId},data:{
    nickname:input.nickname,ageBand:input.ageBand,locale:input.locale,sessionMinutes:input.sessionMinutes
  }});
  if (!updated.count) fail(404,"kid_profile_missing","Child profile not found");
  // Activated devices use the profile's current locale and time policy on each request.
  return {updated:true};
}
export async function deleteKidProfile(guardianId:string,id:string) {
  const deleted=await db().kidProfile.deleteMany({where:{id,guardianId}});
  if (!deleted.count) fail(404,"kid_profile_missing","Child profile not found");
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
  return {pinConfigured:true};
}
export async function activateKidDevice(guardianId:string, profileId:string, pin:string,deviceName:string) {
  await checkGuardianPin(guardianId,pin);
  const profile=await db().kidProfile.findFirst({where:{id:profileId,guardianId}});
  if (!profile) fail(404,"kid_profile_missing","Child profile not found");
  if(await db().kidDeviceSession.count({where:{guardianId,revokedAt:null,expiresAt:{gt:new Date()}}})>=10)
    fail(409,"kid_device_limit","At most ten active devices are supported");
  const token=newDeviceToken();
  await db().kidDeviceSession.create({data:{
    guardianId,profileId,tokenHash:tokenHash(token),deviceName,
    expiresAt:kidSessionDeadline(profile.sessionMinutes)
  }});
  return {token,locale:profile.locale};
}
export async function exitKidDevice(token:string,pin:string) {
  const device=await findKidDevice(token);
  // Permit PIN exit when the session time expires, but not if remotely revoked.
  if (!device || device.revokedAt) fail(403,"kid_device_invalid","Device authorization is unavailable");
  await checkGuardianPin(device.guardianId,pin);
  await db().kidDeviceSession.updateMany({
    where:{id:device.id,revokedAt:null},data:{revokedAt:new Date()}
  });
  return {unlocked:true};
}
