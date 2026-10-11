import { newDeviceToken,tokenHash } from "./credentials";
import { db } from "../platform/db";
import { fail } from "../platform/auth";
import { checkGuardianPin,guardianOverview } from "./service";
import type { nativeKidFromHeaders } from "./service";
import { TIMEZONES } from "./time";
type Kid=Awaited<ReturnType<typeof nativeKidFromHeaders>>;
const PARENT_LIFETIME_MS=10*60_000;

/** A parent PIN unlocks only this device for ten minutes; never grants adult REST/MCP identity. */
export async function grantParentAccess(kid:Kid,pin:string){
 await checkGuardianPin(kid.guardianId,pin);
 const token=newDeviceToken(),now=new Date();
 await db().$transaction([
  db().kidParentAccess.updateMany({where:{deviceId:kid.id,revokedAt:null},data:{revokedAt:now}}),
  db().kidParentAccess.create({data:{guardianId:kid.guardianId,deviceId:kid.id,
    tokenHash:tokenHash(token),expiresAt:new Date(now.getTime()+PARENT_LIFETIME_MS)}})
 ]);
 return {parentToken:token,expiresAt:new Date(now.getTime()+PARENT_LIFETIME_MS).toISOString()};
}
export async function requireParentAccess(kid:Kid,header:string|null){
 const match=header?.match(/^Bearer ([A-Za-z0-9_-]{40,90})$/);
 if(!match)fail(401,"parent_auth_required","Guardian PIN authentication required");
 const access=await db().kidParentAccess.findUnique({where:{tokenHash:tokenHash(match[1])}});
 if(!access || access.guardianId!==kid.guardianId || access.deviceId!==kid.id ||
    access.revokedAt || access.expiresAt<=new Date())
   fail(401,"parent_session_expired","Parent access has expired");
 return access;
}
export async function endParentAccess(kid:Kid,header:string|null){
 const access=await requireParentAccess(kid,header);
 await db().kidParentAccess.updateMany({where:{id:access.id,revokedAt:null},data:{revokedAt:new Date()}});
 return {closed:true};
}
export async function parentDashboard(guardianId:string){
  const overview = await guardianOverview(guardianId);
  const now = new Date();
  const weekStart = new Date(now.getTime()-7*86400000);
  const profiles = await Promise.all(overview.profiles.map(async (profile)=>{
    const [usage,plays] = await Promise.all([
      db().kidUsageMinute.findMany({
        where:{profileId:profile.id,createdAt:{gte:weekStart}},
        select:{localDay:true}
      }),
      db().playSession.findMany({
        where:{
          startedAt:{gte:weekStart},
          OR:[
            {run:{is:{kidOwnership:{is:{profileId:profile.id}}}}},
            {kidSingle:{is:{profileId:profile.id}}}
          ]
        },
        take:300,
        orderBy:{startedAt:"desc"},
        select:{
          status:true,
          quiz:{
            select:{
              topicLinks:{
                take:4,
                where:{isSpoiler:false},
                select:{topic:{select:{key:true}}}
              }
            }
          }
        }
      })
    ]);
    const days = new Map<string,number>();
    for (const minute of usage) days.set(minute.localDay,(days.get(minute.localDay)??0)+1);
    const topics = new Map<string,number>();
    for (const play of plays) {
      for (const tag of play.quiz.topicLinks) {
        const key=tag.topic.key;
        topics.set(key,(topics.get(key)??0)+1);
      }
    }
    const solved=plays.filter(p=>p.status==="SOLVED").length;
    const played=plays.filter(p=>p.status==="SOLVED"||p.status==="FAILED").length;
    return {
      profileId:profile.id,
      solvedLast7Days:solved,
      playedLast7Days:played,
      successRate:played?Math.round(solved/played*100):0,
      minutesLast7Days:usage.length,
      usageByDay:[...days].sort(([a],[b])=>a.localeCompare(b)).map(([day,minutes])=>({day,minutes})),
      topTopics:[...topics].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([topic,count])=>({topic,count}))
    };
  }));
  return {...overview,insights:profiles,serverNow:now.toISOString(),availableTimeZones:TIMEZONES};
}
