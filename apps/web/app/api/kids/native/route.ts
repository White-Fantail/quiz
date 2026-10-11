import { z, ZodError } from "zod";
import { PlatformError, fail } from "../../../../src/modules/platform/auth";
import { execute } from "../../../../src/modules/platform/operations";
import { nativeKidFromHeaders,redeemNativePairTicket,releaseNativeKidDevice } from "../../../../src/modules/kids/service";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
const pair=z.object({action:z.literal("pair"),code:z.string().min(24).max(32),deviceName:z.string().trim().min(1).max(50)}).strict();
const unlock=z.object({action:z.literal("unlock"),pin:z.string().regex(/^[0-9]{6}$/)}).strict();
const actions=z.discriminatedUnion("action",[pair,unlock]);
const query=z.object({
  view:z.enum(["session","catalog"]),offset:z.coerce.number().int().min(0).max(100000).default(0),
  limit:z.coerce.number().int().min(1).max(30).default(8),
  answerType:z.enum(["person","animal","place","thing","event","concept","other"]).optional(),
  topic:z.string().max(80).optional(),locale:z.enum(["en","ko"]).optional()
}).strict();
function response(data:unknown){return Response.json({data},{headers});}
function errorResponse(error:unknown) {
  if(error instanceof PlatformError) return Response.json({error:error.code,message:error.message},{status:error.status,headers});
  if(error instanceof ZodError) return Response.json({error:"validation_error"},{status:400,headers});
  console.error("Native Kids API failure",error);
  return Response.json({error:"internal_error"},{status:500,headers});
}
export async function GET(request:Request) {
 try {
  // No cookie-auth fallback. A child token never maps to an adult actor.
  const kid=await nativeKidFromHeaders(request.headers);
  const url=new URL(request.url);
  const data=query.parse(Object.fromEntries(url.searchParams.entries()));
  if(data.locale && data.locale!==kid.profile.locale)
    fail(403,"kid_locale_locked","Only the guardian-approved language is available");
  if(data.view==="session") return response({active:true,
    profile:{nickname:kid.profile.nickname,ageBand:kid.profile.ageBand,locale:kid.profile.locale},
    expiresAt:kid.expiresAt.toISOString()});
  const result=await execute("quiz_list",{
    kids:true,locale:kid.profile.locale,offset:data.offset,limit:data.limit,
    ...(data.answerType?{answerType:data.answerType}:{}),
    ...(data.topic?{topic:data.topic}:{})
  },null);
  return response(result);
 }catch(error){return errorResponse(error);}
}
export async function POST(request:Request) {
 try {
  if(Number(request.headers.get("content-length")??0)>2048)
    fail(413,"too_large","Request too large");
  if(!request.headers.get("content-type")?.startsWith("application/json"))
    fail(415,"invalid_content_type","JSON required");
  const data=actions.parse(await request.json());
  if(data.action==="pair") {
    // Pairing code is guardian-issued, random and stored only as a hash.
    // Never accept an adult browser session or cookie in place of the code.
    const paired=await redeemNativePairTicket(data.code,data.deviceName);
    return response(paired);
  }
  const kid=await nativeKidFromHeaders(request.headers);
  return response(await releaseNativeKidDevice(kid.id,kid.guardianId,data.pin));
 }catch(error){return errorResponse(error);}
}
