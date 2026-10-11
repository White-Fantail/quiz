// MCP protected-resource discovery (RFC 9728). The OIDC/OAuth issuing provider must be configured separately.
export function GET(request: Request) {
  const origin = process.env.PUBLIC_ORIGIN || new URL(request.url).origin;
  const issuer = process.env.OIDC_ISSUER;
  if (!issuer) return Response.json({ error: "auth_unconfigured" }, { status: 503 });
  return Response.json({
    resource: new URL("/api/mcp", origin).href,
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "profile"],
    resource_documentation: new URL("/api/v1/catalog", origin).href
  }, { headers: { "Cache-Control": "no-store" } });
}
