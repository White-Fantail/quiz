import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { requireMcpAuth } from "@better-auth/mcp";
import { ZodError } from "zod";
import { auth, mcpResource, siteOrigin } from "../../../src/lib/auth";
import { actorByIdentity, PlatformError, type Actor } from "../../../src/modules/platform/auth";
import { execute } from "../../../src/modules/platform/operations";
import { operations, type Operation } from "../../../src/modules/platform/contracts";
import { isAllowedMcpOrigin } from "../../../src/lib/mcp-origin";
import { describeMcpAuthFailure } from "../../../src/lib/mcp-auth-diagnostics";
import { mcpOAuthTraceEnabled, summarizeMcpBearer } from "../../../src/lib/mcp-oauth-trace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createServer(actor: Actor) {
  const server = new McpServer({ name: "quizdip", version: "0.3.0" });
  for (const name of Object.keys(operations) as Operation[]) {
    const spec = operations[name];
    server.registerTool("quizdip_" + name, {
      title: "QuizDip " + name.replaceAll("_", " "),
      description: spec.description,
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
  return server;
}

const authenticatedPost = requireMcpAuth(auth, async (request, claims) => {
  const origin = request.headers.get("origin");
  if (!isAllowedMcpOrigin(origin, siteOrigin)) {
    console.warn("MCP request blocked: untrusted origin");
    return Response.json({ error: "origin_forbidden" }, { status: 403 });
  }

  // The MCP authorization boundary verified signature, issuer, audience,
  // expiration, PKCE-derived grant and the mcp:tools scope.
  if (typeof claims.sub !== "string" || !claims.sub)
    return Response.json({ error: "invalid_identity" }, { status: 401 });
  const actor = await actorByIdentity(claims.sub);
  // Serve both 2025-era stateless MCP clients (including Claude connector probes)
  // and 2026-07-28 per-request MCP clients without changing OAuth protection.
  const handler = createMcpHandler(() => createServer(actor), {
    legacy: "stateless",
    onerror: (error) => console.error("MCP handler error", error.name),
  });
  const response = await handler.fetch(request);
  if (response.status >= 400) {
    console.warn("MCP protocol request failed after OAuth", {
      status: response.status,
      protocol: request.headers.get("mcp-protocol-version"),
      method: request.headers.get("mcp-method"),
    });
  }
  return response;
}, {
  resource: mcpResource,
  requiredScopes: ["mcp:tools"],
  // Advise OAuth clients to request refresh-token eligibility at initial authorization.
  // This is only a 401 challenge hint; access still requires mcp:tools and user consent.
  challengeScopes: ["mcp:tools", "offline_access"],
});

/**
 * Observe the Better Auth boundary, including failures that happen BEFORE
 * the inner MCP handler runs. Responses are forwarded unchanged to clients.
 */
export async function POST(request: Request) {
  const response = await authenticatedPost(request);
  if (response.status === 401 || response.status === 403) {
    console.warn("MCP OAuth rejection", describeMcpAuthFailure(request, response, mcpResource));
    if (mcpOAuthTraceEnabled()) {
      // This fingerprint can be compared to the token issuance fingerprint.
      // It expires automatically and contains no credential or user identity.
      console.warn("[mcp-oauth-trace] MCP token rejected", {
        status: response.status,
        ...summarizeMcpBearer(request, mcpResource, siteOrigin),
      });
    }
  }
  return response;
}
