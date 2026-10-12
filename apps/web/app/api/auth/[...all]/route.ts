import { toNextJsHandler } from "better-auth/next-js";
import { auth, mcpResource, siteOrigin } from "../../../../src/lib/auth";
import {
  mcpOAuthTraceEnabled,
  summarizeOAuthRequest,
  summarizeOAuthResponse,
} from "../../../../src/lib/mcp-oauth-trace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers=toNextJsHandler(auth);

function locked(request:Request,handler:(request:Request)=>Promise<Response>|Response) {
  if (request.headers.get("cookie")?.split(";").some(x=>x.trim().startsWith("quizdip-kid-session=")))
    return Response.json({error:"kid_mode_active"},{status:403});
  return handler(request);
}

/**
 * Trace the OAuth authorization and token endpoints only until 16 Oct 2026.
 * The Better Auth handler receives the unmodified request and its response is
 * returned unchanged. Logging is explicitly best-effort and non-blocking.
 */
async function handle(request:Request, handler:(request:Request)=>Promise<Response>|Response):Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const phase = pathname.endsWith("/oauth2/authorize") ? "authorize"
    : pathname.endsWith("/oauth2/token") ? "token" : null;
  const trace = phase && mcpOAuthTraceEnabled();
  let input: Awaited<ReturnType<typeof summarizeOAuthRequest>> | null = null;
  if (trace) {
    try {
      input = await summarizeOAuthRequest(request, phase, mcpResource);
    } catch {
      // Logging must never interrupt authentication.
    }
  }
  const response = await locked(request, handler);
  if (trace && input) {
    try {
      const result = await summarizeOAuthResponse(response, phase, mcpResource, siteOrigin);
      console.info("[mcp-oauth-trace]", { ...input, ...result });
    } catch {
      // Diagnostics are non-authoritative and must never affect the response.
    }
  }
  return response;
}

export const GET=(request:Request)=>handle(request,handlers.GET);
export const POST=(request:Request)=>handle(request,handlers.POST);
