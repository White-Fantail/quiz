import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { requireMcpAuth } from "@better-auth/mcp";
import { ZodError } from "zod";
import { auth, mcpResource, siteOrigin } from "../../../src/lib/auth";
import { actorByIdentity, PlatformError, type Actor } from "../../../src/modules/platform/auth";
import { execute } from "../../../src/modules/platform/operations";
import { operations, type Operation } from "../../../src/modules/platform/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createServer(actor: Actor) {
  const server = new McpServer({ name: "quizdip", version: "0.3.0" });
  for (const name of Object.keys(operations) as Operation[]) {
    const spec = operations[name];
    // Preserve old MCP tool names for already-connected clients; prefer QuizDip for new connections.
    for (const prefix of ["quizdip", "clupio"] as const) {
      const legacy = prefix === "clupio";
      server.registerTool(prefix + "_" + name, {
      title: "QuizDip " + name.replaceAll("_", " ") + (legacy ? " (legacy alias)" : ""),
      description: legacy ? `[Deprecated alias: use quizdip_${name}] ${spec.description}` : spec.description,
      inputSchema: spec.schema as any,
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
  }
  return server;
}

export const POST = requireMcpAuth(auth, async (request, claims) => {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(siteOrigin).origin)
    return Response.json({ error: "origin_forbidden" }, { status: 403 });

  // The MCP authorization boundary verified signature, issuer, audience,
  // expiration, PKCE-derived grant and the mcp:tools scope.
  if (typeof claims.sub !== "string" || !claims.sub)
    return Response.json({ error: "invalid_identity" }, { status: 401 });
  const actor = await actorByIdentity(claims.sub);
  const handler = createMcpHandler(() => createServer(actor), { legacy: "reject" });
  return handler.fetch(request);
}, { resource: mcpResource, requiredScopes: ["mcp:tools"] });
