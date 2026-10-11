import { z,ZodError } from "zod";
import { PlatformError,fail,requireSameOrigin } from "../../../../../src/modules/platform/auth";
import { readCookie,KIDS_COOKIE,tokenHash } from "../../../../../src/modules/kids/credentials";
import { checkGuardianPin } from "../../../../../src/modules/kids/service";
import { db } from "../../../../../src/modules/platform/db";

export const runtime="nodejs",dynamic="force-dynamic";
const headers={"Cache-Control":"no-store,private","Referrer-Policy":"no-referrer"};
export async function POST(request:Request){
 try{
   requireSameOrigin(request);
   if(Number(request.headers.get("content-length")??0)>512)
     fail(413,"too_large","Request too large");
   if(!request.headers.get("content-type")?.startsWith("application/json"))
     fail(415,"invalid_content_type","JSON required");
   const {pin}=z.object({pin:z.string().regex(/^[0-9]{6}$/)}).strict().parse(await request.json());
   const token=readCookie(request.headers.get("cookie"),KIDS_COOKIE);
   if(!token)fail(403,"legacy_kid_invalid","Old Kids device token missing");
   const device=await db().kidDeviceSession.findUnique({
     where:{tokenHash:tokenHash(token)},select:{id:true,guardianId:true,clientKind:true}
   });
   if(!device || device.clientKind!=="WEB")
     fail(403,"legacy_kid_invalid","This is not a retired web device");
   // PIN remains required even AFTER all WEB sessions were revoked by migration:
   // blindly clearing this cookie can expose the adult's existing Better Auth session.
   await checkGuardianPin(device.guardianId,pin);
   await db().kidDeviceSession.updateMany({
     where:{id:device.id,clientKind:"WEB"},
     data:{revokedAt:new Date()}
   });
   const response=Response.json({data:{unlocked:true}},{headers});
   response.headers.append("Set-Cookie",
     KIDS_COOKIE+"=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"+
     (process.env.NODE_ENV==="production"?"; Secure":""));
   return response;
 }catch(e){
   if(e instanceof PlatformError)return Response.json({error:e.code},{status:e.status,headers});
   if(e instanceof ZodError)return Response.json({error:"validation_error"},{status:400,headers});
   console.error("Legacy Kids exit failure");
   return Response.json({error:"internal_error"},{status:500,headers});
 }
}
