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

/**
 * A few OAuth clients redeem a refresh token without an RFC 8707 `resource`
 * parameter. Better Auth normally inherits the resource stored with the refresh
 * grant; however older grants can lack that binding even if the initial token
 * exchange requested the MCP resource explicitly. The resulting successful
 * refresh can then mint an opaque access token, which the MCP JWT guard rejects.
 *
 * This server exposes one OAuth protected resource. Default to that resource on
 * refresh only, and let Better Auth perform the actual grant, client, scope,
 * resource-authorization and token-rotation checks. Never change an explicitly
 * supplied resource (including an empty or invalid value).
 */
export async function defaultMcpRefreshResource(
  request: Request,
  mcpResource: string,
): Promise<{ request: Request; applied: boolean }> {
  if (request.method !== "POST") return { request, applied: false };
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/oauth2/token")) return { request, applied: false };
  const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded")
    return { request, applied: false };

  // Limit parsing to small OAuth token requests; never read or log credentials.
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > 8192) return { request, applied: false };
  const body = await request.clone().text();
  if (body.length > 8192) return { request, applied: false };
  const form = new URLSearchParams(body);
  if (form.get("grant_type") !== "refresh_token" || form.has("resource"))
    return { request, applied: false };

  form.set("resource", mcpResource);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const normalized = new Request(request, { headers, body: form.toString() });
  return { request: normalized, applied: true };
}
