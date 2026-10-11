import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../src/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers=toNextJsHandler(auth);
function locked(request:Request,handler:(request:Request)=>Promise<Response>|Response) {
  if (request.headers.get("cookie")?.split(";").some(x=>x.trim().startsWith("quizdip-kid-session=")))
    return Response.json({error:"kid_mode_active"},{status:403});
  return handler(request);
}
export const GET=(request:Request)=>locked(request,handlers.GET);
export const POST=(request:Request)=>locked(request,handlers.POST);
