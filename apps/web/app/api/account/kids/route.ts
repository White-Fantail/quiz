import { z, ZodError } from "zod";
import { actorFor, requireActor, requireSameOrigin, PlatformError, fail } from "../../../../src/modules/platform/auth";
import { auth } from "../../../../src/lib/auth";
import { guardianOverview, addKidProfile, updateKidProfile, deleteKidProfile, revokeKidDevice, setGuardianPin, issueNativePairTicket } from "../../../../src/modules/kids/service";
import { hasKidCookie } from "../../../../src/modules/kids/credentials";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const profile=z.object({
  nickname:z.string().trim().min(1).max(32).regex(/^[^<>\x00-\x1F]+$/),
  ageBand:z.enum(["EARLY","MIDDLE","OLDER"]),locale:z.enum(["en","ko"]),
  sessionMinutes:z.union([z.literal(0),z.literal(15),z.literal(30),z.literal(60),z.literal(120)])
});
const uuid=z.string().uuid();
const pin=z.string().regex(/^[0-9]{6}$/);
const action=z.discriminatedUnion("action",[
  z.object({action:z.literal("pin_setup"),pin}),
  z.object({action:z.literal("pin_change"),pin,previous:pin}),
  z.object({action:z.literal("pin_reset"),pin}),
  z.object({action:z.literal("profile_add"),...profile.shape}),
  z.object({action:z.literal("profile_update"),id:uuid,...profile.shape}),
  z.object({action:z.literal("profile_delete"),id:uuid}),
  z.object({action:z.literal("device_revoke"),id:uuid}),
  z.object({action:z.literal("native_pair_issue"),profileId:uuid,pin})
]);
async function handle(request:Request) {
  try {
    if (hasKidCookie(request.headers.get("cookie"))) fail(403,"legacy_kid_locked","A parent must unlock this old device first");
    requireSameOrigin(request);
    const actor=requireActor(await actorFor(request));
    if(request.method==="GET") return Response.json({data:await guardianOverview(actor.id)},{headers:{"Cache-Control":"no-store"}});
    const size=Number(request.headers.get("content-length")??0);
    if(size>8192) fail(413,"too_large","Request too large");
    const p=action.parse(await request.json());
    let result:unknown;
    switch(p.action) {
      case "pin_setup": {
        const status=await guardianOverview(actor.id);
        if(status.pinConfigured) fail(409,"kid_pin_exists","Use PIN change instead");
        result=await setGuardianPin(actor.id,p.pin);break;
      }
      case "pin_change":result=await setGuardianPin(actor.id,p.pin,p.previous);break;
      case "pin_reset": {
        // Recovery requires fresh OAuth sign-in; a long-lived browser session alone is insufficient.
        const session=await auth.api.getSession({headers:request.headers});
        if(!session?.session?.createdAt || Date.now()-new Date(session.session.createdAt).getTime()>5*60000)
          fail(403,"kid_reauth_required","Sign in again before resetting the PIN");
        result=await setGuardianPin(actor.id,p.pin,undefined,true);break;
      }
      case "profile_add":result=await addKidProfile(actor.id,p);break;
      case "profile_update":result=await updateKidProfile(actor.id,p.id,p);break;
      case "profile_delete":result=await deleteKidProfile(actor.id,p.id);break;
      case "device_revoke":result=await revokeKidDevice(actor.id,p.id);break;
      case "native_pair_issue":result=await issueNativePairTicket(actor.id,p.profileId,p.pin);break;
    }
    return Response.json({data:result},{headers:{"Cache-Control":"no-store"}});
  }catch(e) {
    if(e instanceof PlatformError) return Response.json({error:e.code,message:e.message},{status:e.status});
    if(e instanceof ZodError) return Response.json({error:"validation_error",issues:e.issues},{status:400});
    console.error("Guardian API failure");
    return Response.json({error:"internal_error"},{status:500});
  }
}
export const GET=handle;
export const POST=handle;
