import { z, ZodError } from "zod";
import { nativeKidFromHeaders } from "../../../../../src/modules/kids/service";
import { fail, PlatformError } from "../../../../../src/modules/platform/auth";
import { requirePlayable } from "../../../../../src/modules/kids/time";
import { startKidPack } from "../../../../../src/modules/kids/packs";
import { startKidRun,startKidSingle,currentKidRun,currentKidSingle,
  kidClue,kidGuess,kidMedia,kidTreasures,kidReport,childActor } from "../../../../../src/modules/kids/game";

import {localRunBundle,localRunSync,localRunMedia,localSingleBundle,localSingleSync,localSingleMedia} from "../../../../../src/modules/platform/local-play";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
const uuid=z.string().uuid(),token=z.string().min(32).max(200);
const session={sessionId:uuid,sessionToken:token};
const run={runId:uuid,runToken:token};
const actions=z.discriminatedUnion("action",[
  z.object({action:z.literal("run_start"),mode:z.literal("RANDOM_FIVE"),
    avoidQuizIds:z.array(uuid).max(1000).default([])}).strict(),
  z.object({action:z.literal("pack_start"),packId:uuid}).strict(),
  z.object({action:z.literal("run_current"),...run}).strict(),
  z.object({action:z.literal("run_bundle"),...run}).strict(),
  z.object({action:z.literal("run_sync"),...run,results:z.array(z.object({
    position:z.number().int().min(0).max(10000),cluesUsed:z.number().int().min(0).max(15),
    status:z.enum(["SOLVED","FAILED"]),score:z.number().int().min(0).max(100)
  })).max(100)}).strict(),
  z.object({action:z.literal("run_local_media"),...run,position:z.number().int().min(0),mediaId:uuid}).strict(),
  z.object({action:z.literal("single_bundle"),...session}).strict(),
  z.object({action:z.literal("single_sync"),...session,cluesUsed:z.number().int().min(0).max(15),
    status:z.enum(["SOLVED","FAILED"]),score:z.number().int().min(0).max(100)}).strict(),
  z.object({action:z.literal("single_local_media"),...session,mediaId:uuid}).strict(),
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
     case "pack_start":return respond(await startKidPack(kid,data.packId));
     case "run_current":return respond(await currentKidRun(kid,data.runId,data.runToken));
     case "run_bundle":return respond(await localRunBundle(data,childActor(kid)));
     case "run_sync":return respond(await localRunSync(data,childActor(kid)));
     case "run_local_media":return respond(await localRunMedia(data,childActor(kid)));
     case "single_bundle":return respond(await localSingleBundle(data,childActor(kid)));
     case "single_sync":return respond(await localSingleSync(data,childActor(kid)));
     case "single_local_media":return respond(await localSingleMedia(data,childActor(kid)));
     case "single_start":return respond(await startKidSingle(kid,data.quizId));
     case "single_current":return respond(await currentKidSingle(kid,data.sessionId,data.sessionToken));
     case "clue":return respond(await kidClue(kid,data.sessionId,data.sessionToken));
     case "guess":return respond(await kidGuess(kid,data.sessionId,data.sessionToken,data.guess));
     case "media":return respond(await kidMedia(kid,data.sessionId,data.sessionToken,data.mediaId));
     case "report":return respond(await kidReport(kid,data.quizId,data.reason));
   }
 }catch(e){return error(e);}
}
