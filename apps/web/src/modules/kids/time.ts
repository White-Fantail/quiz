import { db } from "../platform/db";
import { localChildDay,utcMinuteSlot } from "@quizdip/domain";
import { fail } from "../platform/auth";
import type { nativeKidFromHeaders } from "./service";

type Kid=Awaited<ReturnType<typeof nativeKidFromHeaders>>;
export const TIMEZONES=["Pacific/Auckland","Australia/Sydney","Asia/Seoul","Asia/Tokyo","Etc/UTC","America/Los_Angeles","Europe/London"] as const;
const REST_MS=10*60_000;
const STALE_MS=3*60_000;
export const USAGE_PULSE_MS=45_000;
const DAY_MS=86_400_000;

/** Date is calculated by the server, not by user-supplied clocks or locale. */
export const localDay=localChildDay;
export async function status(kid:Kid,now=new Date()){
  const localDate=localDay(now,kid.profile.timeZone);
  const used=await db().kidUsageMinute.count({where:{profileId:kid.profileId,localDay:localDate}});
  const limits={dailyMinutes:kid.profile.dailyMinutes,playSessionMinutes:kid.profile.playSessionMinutes,
    breakEveryMinutes:kid.profile.breakEveryMinutes,timeZone:kid.profile.timeZone};
  const sessionMinutesUsed=kid.playStartedAt?Math.max(0,Math.floor((now.getTime()-kid.playStartedAt.getTime())/60000)):0;
  const blockedUntil=kid.breakUntil && kid.breakUntil>now?kid.breakUntil.toISOString():null;
  const limitReached=limits.dailyMinutes>0 && used>=limits.dailyMinutes;
  return {localDay:localDate,usedMinutes:used,remainingMinutes:limits.dailyMinutes===0?null:Math.max(0,limits.dailyMinutes-used),
    sessionMinutesUsed,blockedUntil,limitReached,limits,serverNow:now.toISOString()};
}
/** Local-first gameplay: the device enforces its own advisory play budget.
 * Pairing, audience and moderation permissions remain server-authorized. */
export async function requirePlayable(_kid:Kid){
  return;
}
/** One minute counted once per profile across all devices, with serializable retries.
 * A pulse requires actual foreground activity; no client duration/clock is accepted. */
export async function heartbeat(kid:Kid){
  for(let attempt=0;attempt<3;attempt++){
    try{
      const now=new Date();
      const result=await db().$transaction(async tx=>{
        const device=await tx.kidDeviceSession.findUnique({where:{id:kid.id},include:{profile:true}});
        if(!device || device.clientKind!=="NATIVE" || device.revokedAt || device.expiresAt<=now ||
          device.profileId!==kid.profileId)fail(401,"native_session_invalid","Device no longer active");
        if(device.breakUntil && device.breakUntil>now)
          fail(429,"kid_break_required","Take a short break");
        const minute=utcMinuteSlot(now),today=localDay(now,device.profile.timeZone);
        const count=await tx.kidUsageMinute.count({where:{profileId:device.profileId,localDay:today}});
        const present=await tx.kidUsageMinute.findUnique({where:{profileId_utcMinute:{
          profileId:device.profileId,utcMinute:minute}}});
        if(device.profile.dailyMinutes>0 && count>=device.profile.dailyMinutes && !present)
          fail(429,"kid_daily_limit","Daily play time finished");
        const stale=!device.lastUsageAt || now.getTime()-device.lastUsageAt.getTime()>=STALE_MS;
        const startedAt=stale?now:(device.playStartedAt??now);
        if(!stale && device.profile.playSessionMinutes>0 &&
          now.getTime()-startedAt.getTime()>=device.profile.playSessionMinutes*60000){
          await tx.kidDeviceSession.update({where:{id:device.id},
            data:{breakUntil:new Date(now.getTime()+REST_MS)}});
          return {blocked:"kid_session_limit" as const};
        }
        if(!present)await tx.kidUsageMinute.create({data:{
          profileId:device.profileId,deviceId:device.id,utcMinute:minute,localDay:today
        }});
        await tx.kidDeviceSession.update({where:{id:device.id},
          data:{playStartedAt:startedAt,lastUsageAt:now,breakUntil:null}});
        const used=count+(present?0:1);
        return {status:{localDay:today,usedMinutes:used,
          remainingMinutes:device.profile.dailyMinutes===0?null:Math.max(0,device.profile.dailyMinutes-used),
          sessionMinutesUsed:Math.floor((now.getTime()-startedAt.getTime())/60000),
          blockedUntil:null,limitReached:device.profile.dailyMinutes>0&&used>=device.profile.dailyMinutes,
          limits:{dailyMinutes:device.profile.dailyMinutes,playSessionMinutes:device.profile.playSessionMinutes,
            breakEveryMinutes:device.profile.breakEveryMinutes,timeZone:device.profile.timeZone},
          serverNow:now.toISOString()}};
      },{isolationLevel:"Serializable"});
      if("blocked" in result)fail(429,result.blocked ?? "kid_session_limit","Session complete: rest for 10 minutes");
      return result.status;
    }catch(e:any){
      if((e?.code==="P2034"||e?.code==="P2002")&&attempt<2)continue;
      throw e;
    }
  }
  fail(409,"kid_usage_conflict","Try your play-time check again");
}
/** Reclaim old minute slots after 90 days. Admin cron only; profiles cascade on deletion. */
export async function pruneOldUsage(now=new Date()){
  const [usage,parents,tickets]=await Promise.all([
    db().kidUsageMinute.deleteMany({where:{createdAt:{lt:new Date(now.getTime()-90*DAY_MS)}}}),
    db().kidParentAccess.deleteMany({where:{expiresAt:{lt:new Date(now.getTime()-DAY_MS)}}}),
    db().kidPairTicket.deleteMany({where:{expiresAt:{lt:new Date(now.getTime()-DAY_MS)}}})
  ]);
  return {count:usage.count,parentSessions:parents.count,pairTickets:tickets.count};
}
