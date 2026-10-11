import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { ZodError } from "zod";
import { actorFor, PlatformError, type Actor } from "../../../src/modules/platform/auth";
import { execute } from "../../../src/modules/platform/operations";
import { operations, type Operation } from "../../../src/modules/platform/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createServer(actor: Actor) {
  const server = new McpServer({ name: "clupio", version: "0.2.0" });
  for (const name of Object.keys(operations) as Operation[]) {
    const spec = operations[name];
    // The schemas are the same Zod validators used by REST. Type-erasure is limited to MCP registration.
    server.registerTool("clupio_" + name, {
      title: "Clupio " + name.replaceAll("_", " "),
      description: spec.description,
      inputSchema: spec.schema as any
    }, async (args: any) => {
      try {
        const value = await execute(name, args, actor);
        return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
      } catch (error) {
        const message = error instanceof PlatformError ? error.code + ": " + error.message
          : error instanceof ZodError ? "validation_error: " + JSON.stringify(error.issues) : "internal_error";
        if (!(error instanceof PlatformError || error instanceof ZodError)) console.error("MCP operation failed", error);
        return { isError: true, content: [{ type: "text" as const, text: message }] };
      }
    });
  }
  return server;
}

async function serve(request: Request) {
  const origin = request.headers.get("origin");
  const publicOrigin = process.env.PUBLIC_ORIGIN;
  if (origin && (!publicOrigin || origin !== new URL(publicOrigin).origin))
    return Response.json({ error: "origin_forbidden" }, { status: 403 });
  if (!request.headers.get("authorization")) {
    const metadata = publicOrigin ? new URL("/.well-known/oauth-protected-resource", publicOrigin).href : undefined;
    return Response.json({ error: "authentication_required" }, {
      status: 401,
      headers: { "WWW-Authenticate": metadata ? 'Bearer resource_metadata="' + metadata + '"' : "Bearer",
        "Cache-Control": "no-store" }
    });
  }
  try {
    const actor = await actorFor(request);
    if (!actor) return Response.json({ error: "authentication_required" }, { status: 401 });
    // Fresh per-request stateless handler; no persistent in-memory sessions on Vercel.
    const handler = createMcpHandler(() => createServer(actor));
    return await handler.fetch(request);
  } catch (error) {
    if (error instanceof PlatformError)
      return Response.json({ error: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    console.error("MCP transport failure", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
export const POST = serve;
export const GET = serve;
export const DELETE = serve;
