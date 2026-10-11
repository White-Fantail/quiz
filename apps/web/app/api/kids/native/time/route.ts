import { nativeKidFromHeaders } from "../../../../../src/modules/kids/service";
import { heartbeat,status } from "../../../../../src/modules/kids/time";
import { PlatformError,fail } from "../../../../../src/modules/platform/auth";
export const runtime="nodejs",dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
function respond(data:unknown){return Response.json({data},{headers});}
function failure(e:unknown){
 if(e instanceof PlatformError)return Response.json({error:e.code,message:e.message},{status:e.status,headers});
 console.error("Kids time check failed",e);
 return Response.json({error:"internal_error"},{status:500,headers});
}
export async function GET(request:Request){
 try{
  const kid=await nativeKidFromHeaders(request.headers);
  return respond(await status(kid));
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 try{
  if(request.headers.get("content-type")!=="application/json")
    fail(415,"invalid_content_type","JSON required");
  const body=await request.json();
  if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body).length!==1||body.action!=="heartbeat")
    fail(400,"invalid_action","Only play-time heartbeat allowed");
  const kid=await nativeKidFromHeaders(request.headers);
  return respond(await heartbeat(kid));
 }catch(e){return failure(e);}
}
