import { z,ZodError } from "zod";
import { nativeKidFromHeaders } from "../../../../../src/modules/kids/service";
import { grantParentAccess,requireParentAccess,endParentAccess,parentDashboard } from "../../../../../src/modules/kids/parent-native";
import { addKidProfile,updateKidProfile,deleteKidProfile,revokeKidDevice,
 issueNativePairTicket,setGuardianPin } from "../../../../../src/modules/kids/service";
import { clearKidHistory } from "../../../../../src/modules/kids/history";
import { fail,PlatformError } from "../../../../../src/modules/platform/auth";
import { TIMEZONES } from "../../../../../src/modules/kids/time";
import { db } from "../../../../../src/modules/platform/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
const uuid=z.string().uuid(),pin=z.string().regex(/^[0-9]{6}$/);
const profile=z.object({
 nickname:z.string().trim().min(1).max(32).regex(/^[^<>\x00-\x1F]+$/),
 ageBand:z.enum(["EARLY","MIDDLE","OLDER"]),locale:z.enum(["en","ko"]),
 sessionMinutes:z.union([z.literal(0),z.literal(15),z.literal(30),z.literal(60),z.literal(120)]).default(0),
 dailyMinutes:z.union([z.literal(0),z.literal(15),z.literal(30),z.literal(45),z.literal(60),z.literal(90),z.literal(120)]),
 playSessionMinutes:z.union([z.literal(0),z.literal(10),z.literal(15),z.literal(20),z.literal(30),z.literal(45),z.literal(60)]),
 breakEveryMinutes:z.union([z.literal(0),z.literal(15),z.literal(20),z.literal(30)]),
 timeZone:z.enum(TIMEZONES)
}).strict();
const action=z.discriminatedUnion("action",[
 z.object({action:z.literal("authorize"),pin}).strict(),
 z.object({action:z.literal("logout")}).strict(),
 z.object({action:z.literal("profile_add"),profile}).strict(),
 z.object({action:z.literal("profile_update"),id:uuid,profile}).strict(),
 z.object({action:z.literal("profile_delete"),id:uuid,confirm:z.literal(true)}).strict(),
 z.object({action:z.literal("history_delete"),id:uuid,confirm:z.literal(true)}).strict(),
 z.object({action:z.literal("device_revoke"),id:uuid,confirm:z.literal(true)}).strict(),
 z.object({action:z.literal("native_pair_issue"),profileId:uuid,pin}).strict(),
 z.object({action:z.literal("pin_change"),previous:pin,pin}).strict()
]);
function response(data:unknown){return Response.json({data},{headers});}
/** Audit parent actions without child nicknames, PINs, codes, bearer credentials or quiz content. */
async function audited(guardianId:string,action:string,result:unknown){
 await db().auditLog.create({data:{
   actorId:guardianId,action:"kids.native."+action,objectId:guardianId
 }}).catch(()=>undefined);
 return response(result);
}
function failure(e:unknown){
 if(e instanceof PlatformError)return Response.json({error:e.code,message:e.message},{status:e.status,headers});
 if(e instanceof ZodError)return Response.json({error:"validation_error"},{status:400,headers});
 console.error("Native guardian operation failed",e);
 return Response.json({error:"internal_error"},{status:500,headers});
}
export async function GET(request:Request){
 try{
  const kid=await nativeKidFromHeaders(request.headers);
  await requireParentAccess(kid,request.headers.get("x-kids-parent"));
  if(new URL(request.url).searchParams.size)fail(400,"invalid_query","Unknown parent query");
  return response(await parentDashboard(kid.guardianId));
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 try{
  if(Number(request.headers.get("content-length")??0)>8192)
    fail(413,"too_large","Request too large");
  if(!request.headers.get("content-type")?.startsWith("application/json"))
    fail(415,"invalid_content_type","JSON required");
  const kid=await nativeKidFromHeaders(request.headers);
  const p=action.parse(await request.json());
  if(p.action==="authorize")return audited(kid.guardianId,p.action,await grantParentAccess(kid,p.pin));
  const parentHeader=request.headers.get("x-kids-parent");
  await requireParentAccess(kid,parentHeader);
  switch(p.action){
    case "logout":return audited(kid.guardianId,p.action,await endParentAccess(kid,parentHeader));
    case "profile_add":return audited(kid.guardianId,p.action,await addKidProfile(kid.guardianId,p.profile));
    case "profile_update":return audited(kid.guardianId,p.action,await updateKidProfile(kid.guardianId,p.id,p.profile));
    case "profile_delete":return audited(kid.guardianId,p.action,await deleteKidProfile(kid.guardianId,p.id));
    case "history_delete":return audited(kid.guardianId,p.action,await clearKidHistory(kid.guardianId,p.id));
    case "device_revoke":return audited(kid.guardianId,p.action,await revokeKidDevice(kid.guardianId,p.id));
    case "native_pair_issue":return audited(kid.guardianId,p.action,await issueNativePairTicket(kid.guardianId,p.profileId,p.pin));
    case "pin_change":return audited(kid.guardianId,p.action,await setGuardianPin(kid.guardianId,p.pin,p.previous));
  }
 }catch(e){return failure(e);}
}
