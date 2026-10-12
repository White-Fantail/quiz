/**
 * RFC 8707 compatibility for MCP clients that request mcp:tools but omit the
 * resource query parameter from the initial authorization request.
 *
 * Better Auth issues opaque tokens without an authorized resource. Its MCP
 * resource server accepts audience-bound JWTs, so use the sole configured
 * MCP resource as the default ONLY for this explicit MCP permission.
 *
 * Never rewrite a request that specifies any resource (even an invalid one),
 * or one without mcp:tools. Better Auth still validates clients, scopes, PKCE,
 * redirect URIs, consent and resource policy as before.
 */
export function defaultMcpAuthorizationResource(
  request: Request,
  mcpResource: string,
): { request: Request; applied: boolean } {
  if (request.method !== "GET") return { request, applied: false };
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/oauth2/authorize"))
    return { request, applied: false };
  const params = url.searchParams;
  if (params.has("resource") || !params.get("scope")?.split(/\s+/).includes("mcp:tools"))
    return { request, applied: false };
  params.set("resource", mcpResource);
  return { request: new Request(url, request), applied: true };
}
