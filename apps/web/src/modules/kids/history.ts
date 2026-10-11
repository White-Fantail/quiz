import { db } from "../platform/db";
import { fail } from "../platform/auth";

/** Guardian-confirmed deletion of a child's play and usage ledger, without deleting their profile.
 * Repeat-safe cleanup runs transactionally and never touches other siblings' data. */
export async function clearKidHistory(guardianId:string,profileId:string){
 return db().$transaction(async tx=>{
   const owned=await tx.kidProfile.findFirst({where:{id:profileId,guardianId},select:{id:true}});
   if(!owned)fail(404,"kid_profile_missing","Child profile not found");
   const [runOwners,singles]=await Promise.all([
     tx.kidPlayRun.findMany({where:{profileId},select:{runId:true}}),
     tx.kidPlaySingle.findMany({where:{profileId},select:{sessionId:true}})
   ]);
   const runIds=runOwners.map(x=>x.runId),ids=singles.map(x=>x.sessionId);
   await tx.kidPlayRun.deleteMany({where:{profileId}});
   await tx.kidPlaySingle.deleteMany({where:{profileId}});
   if(runIds.length||ids.length)await tx.playSession.deleteMany({
     where:{OR:[{runId:{in:runIds}},{id:{in:ids}}]}
   });
   if(runIds.length) {
     await tx.playRunQuestion.deleteMany({where:{runId:{in:runIds}}});
     await tx.playRun.deleteMany({where:{id:{in:runIds}}});
   }
   // Clear the private usage history too. This also resets today's allowance:
   // a deliberate parent-only operation, not accessible from a child device.
   await tx.kidUsageMinute.deleteMany({where:{profileId}});
   await tx.kidDeviceSession.updateMany({where:{profileId,revokedAt:null},data:{
     playStartedAt:null,lastUsageAt:null,breakUntil:null
   }});
   return {deleted:true};
 });
}
