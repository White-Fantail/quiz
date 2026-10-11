import { createHash,timingSafeEqual } from "node:crypto";
import { pruneOldUsage } from "../../../../src/modules/kids/time";
export const runtime="nodejs",dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
/** Deploy with CRON_SECRET; Vercel cron or a private scheduler must supply this bearer.
 * Never schedule without a configured secret, or allow the cleanup endpoint to be public. */
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32)return Response.json({error:"not_configured"},{status:503,headers});
 const supplied=request.headers.get("authorization");
 const actual=supplied?.startsWith("Bearer ")?supplied.slice(7):"";
 const a=createHash("sha256").update(actual).digest(),b=createHash("sha256").update(secret).digest();
 if(!timingSafeEqual(a,b)||!actual)return Response.json({error:"unauthorized"},{status:401,headers});
 try{
   const result=await pruneOldUsage();
   return Response.json({cleaned:result.count},{headers});
 }catch{
   return Response.json({error:"retention_failed"},{status:500,headers});
 }
}
