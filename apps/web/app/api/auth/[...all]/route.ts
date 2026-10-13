import { toNextJsHandler } from "better-auth/next-js";
import { defaultMcpAuthorizationResource } from "../../../../src/lib/mcp-oauth-resource";
import { auth, mcpResource } from "../../../../src/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = toNextJsHandler(auth);

function locked(request: Request, handler: (request: Request) => Promise<Response> | Response) {
  if (request.headers.get("cookie")?.split(";").some(x => x.trim().startsWith("quizdip-kid-session=")))
    return Response.json({ error: "kid_mode_active" }, { status: 403 });
  return handler(request);
}

/**
 * Retain the MCP OAuth resource compatibility fix without temporary
 * access-token logging or response inspection.
 */
function handle(request: Request, handler: (request: Request) => Promise<Response> | Response) {
  const normalized = defaultMcpAuthorizationResource(request, mcpResource);
  return locked(normalized.request, handler);
}

export const GET = (request: Request) => handle(request, handlers.GET);
export const POST = (request: Request) => handle(request, handlers.POST);
