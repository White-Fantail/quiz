import { z, ZodError } from "zod";
import { nativeKidFromHeaders } from "../../../../../src/modules/kids/service";
import { fail, PlatformError } from "../../../../../src/modules/platform/auth";
import { requirePlayable } from "../../../../../src/modules/kids/time";
import { startKidRun,startKidSingle,currentKidRun,currentKidSingle,
  kidClue,kidGuess,kidMedia,kidTreasures,kidReport } from "../../../../../src/modules/kids/game";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
const uuid=z.string().uuid(),token=z.string().min(32).max(200);
const session={sessionId:uuid,sessionToken:token};
const run={runId:uuid,runToken:token};
const actions=z.discriminatedUnion("action",[
  z.object({action:z.literal("run_start"),mode:z.enum(["RANDOM_FIVE","WEEKLY"]),
    avoidQuizIds:z.array(uuid).max(1000).default([])}).strict(),
  z.object({action:z.literal("run_current"),...run}).strict(),
  z.object({action:z.literal("single_start"),quizId:uuid}).strict(),
  z.object({action:z.literal("single_current"),...session}).strict(),
  z.object({action:z.literal("clue"),...session}).strict(),
  z.object({action:z.literal("guess"),...session,guess:z.string().trim().min(1).max(200)}).strict(),
  z.object({action:z.literal("media"),...session,mediaId:uuid}).strict(),
  z.object({action:z.literal("report"),quizId:uuid,reason:z.enum(["UNSAFE","INCORRECT","BROKEN_MEDIA"])}).strict()
]);
function respond(data:unknown){return Response.json({data},{headers});}
function error(error:unknown){
  if(error instanceof PlatformError) return Response.json({error:error.code,message:error.message},{status:error.status,headers});
  if(error instanceof ZodError) return Response.json({error:"validation_error"},{status:400,headers});
  console.error("Kids game request failure",error);
  return Response.json({error:"internal_error"},{status:500,headers});
}
export async function GET(request:Request){
 try{
   const kid=await nativeKidFromHeaders(request.headers);
   if(new URL(request.url).searchParams.get("view")!=="treasures")
     fail(400,"invalid_view","Unknown Kids view");
   await requirePlayable(kid);
   return respond(await kidTreasures(kid));
 }catch(e){return error(e);}
}
export async function POST(request:Request){
 try{
   if(Number(request.headers.get("content-length")??0)>12000)
     fail(413,"too_large","Request too large");
   if(!request.headers.get("content-type")?.startsWith("application/json"))
     fail(415,"invalid_content_type","JSON required");
   const kid=await nativeKidFromHeaders(request.headers);
   const data=actions.parse(await request.json());
   if(data.action!=="report")await requirePlayable(kid);
   switch(data.action){
     case "run_start":return respond(await startKidRun(kid,data.mode,data.avoidQuizIds));
     case "run_current":return respond(await currentKidRun(kid,data.runId,data.runToken));
     case "single_start":return respond(await startKidSingle(kid,data.quizId));
     case "single_current":return respond(await currentKidSingle(kid,data.sessionId,data.sessionToken));
     case "clue":return respond(await kidClue(kid,data.sessionId,data.sessionToken));
     case "guess":return respond(await kidGuess(kid,data.sessionId,data.sessionToken,data.guess));
     case "media":return respond(await kidMedia(kid,data.sessionId,data.sessionToken,data.mediaId));
     case "report":return respond(await kidReport(kid,data.quizId,data.reason));
   }
 }catch(e){return error(e);}
}
