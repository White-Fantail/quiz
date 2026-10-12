import { z, ZodError } from "zod";
import { PlatformError, fail } from "../../../../../src/modules/platform/auth";
import { startNativePairRequest, claimNativePairRequest } from "../../../../../src/modules/kids/service";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer",
  "X-Content-Type-Options":"nosniff"};
const actions=z.discriminatedUnion("action",[
  z.object({action:z.literal("start"),deviceName:z.string().trim().min(1).max(50)}).strict(),
  z.object({action:z.literal("claim"),deviceSecret:z.string().min(40).max(90)}).strict()
]);
export async function POST(request:Request) {
  try {
    if(Number(request.headers.get("content-length")??0)>1024)
      fail(413,"too_large","Request too large");
    if(!request.headers.get("content-type")?.startsWith("application/json"))
      fail(415,"invalid_content_type","JSON required");
    const input=actions.parse(await request.json());
    // Anonymous endpoints never read web OAuth cookies and never grant adult scope.
    const data=input.action==="start"
      ? await startNativePairRequest(input.deviceName)
      : await claimNativePairRequest(input.deviceSecret);
    return Response.json({data},{headers});
  }catch(e){
    if(e instanceof PlatformError)return Response.json({error:e.code,message:e.message},{status:e.status,headers});
    if(e instanceof ZodError)return Response.json({error:"validation_error"},{status:400,headers});
    console.error("Native pair request failed",e);
    return Response.json({error:"internal_error"},{status:500,headers});
  }
}
