import { z, ZodError } from "zod";
import { actorFor, requireActor, requireSameOrigin, PlatformError, fail } from "../../../../src/modules/platform/auth";
import { activateKidDevice, currentKidDevice, exitKidDevice, kidTokenFromHeaders, checkGuardianPin } from "../../../../src/modules/kids/service";
import { KIDS_COOKIE, MAX_DEVICE_AGE_SECONDS, hasKidCookie } from "../../../../src/modules/kids/credentials";
import { LOCALE_COOKIE } from "../../../../src/i18n/core";
import { auth } from "../../../../src/lib/auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const activate=z.object({
  profileId:z.string().uuid(),pin:z.string().regex(/^[0-9]{6}$/),
  deviceName:z.string().trim().min(1).max(50).regex(/^[^<>\x00-\x1F]+$/)
});
const end=z.object({pin:z.string().regex(/^[0-9]{6}$/)});
function setKidCookie(response:Response,token:string,seconds:number) {
  const secure=process.env.NODE_ENV==="production" ? "; Secure":"";
  response.headers.append("Set-Cookie",KIDS_COOKIE+"="+token+"; Path=/; HttpOnly; SameSite=Lax; Max-Age="+seconds+secure);
}
async function handle(request:Request) {
  try{
    requireSameOrigin(request);
    if(request.method==="GET") {
      const device=await currentKidDevice(request.headers);
      return Response.json({data:device?{
        active:true,profile:{nickname:device.profile.nickname,ageBand:device.profile.ageBand,locale:device.profile.locale},
        expiresAt:device.expiresAt
      }:{active:false}},{headers:{"Cache-Control":"no-store"}});
    }
    if(Number(request.headers.get("content-length")??0)>8192) fail(413,"too_large","Request too large");
    if(request.method==="POST") {
      if(hasKidCookie(request.headers.get("cookie"))) fail(403,"kid_mode_active","Unlock the existing child session first");
      const actor=requireActor(await actorFor(request));
      const p=activate.parse(await request.json());
      const created=await activateKidDevice(actor.id,p.profileId,p.pin,p.deviceName);
      const response=Response.json({data:{active:true,locale:created.locale}},{headers:{"Cache-Control":"no-store"}});
      setKidCookie(response,created.token,MAX_DEVICE_AGE_SECONDS);
      response.headers.append("Set-Cookie",LOCALE_COOKIE+"="+created.locale+"; Path=/; SameSite=Lax; Max-Age=31536000"+
        (process.env.NODE_ENV==="production"?"; Secure":""));
      return response;
    }
    if(request.method==="DELETE") {
      const p=end.parse(await request.json());
      const token=kidTokenFromHeaders(request.headers);
      if(!token) fail(403,"kid_device_invalid","No child session on this device");
      let outcome:{unlocked:boolean};
      try {
        outcome=await exitKidDevice(token,p.pin);
      } catch (error) {
        if (!(error instanceof PlatformError) || error.code !== "kid_device_invalid") throw error;
        // A parent may have deleted/revoked this profile on another device.
        // Only the SAME authenticated guardian's verified PIN can clear an orphan cookie.
        const session=await auth.api.getSession({headers:request.headers});
        if (!session?.user?.id) throw error;
        await checkGuardianPin(session.user.id,p.pin);
        outcome={unlocked:true};
      }
      const response=Response.json({data:outcome},{headers:{"Cache-Control":"no-store"}});
      setKidCookie(response,"",0);
      return response;
    }
    return Response.json({error:"not_found"},{status:404});
  }catch(e){
    if(e instanceof PlatformError) return Response.json({error:e.code,message:e.message},{status:e.status});
    if(e instanceof ZodError) return Response.json({error:"validation_error",issues:e.issues},{status:400});
    console.error("Kids device API failure",e);
    return Response.json({error:"internal_error"},{status:500});
  }
}
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
