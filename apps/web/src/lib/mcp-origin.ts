/**
 * External AI clients may include their own Origin header on authenticated MCP calls.
 * Keep DNS-rebinding protection without restricting valid OAuth-bound requests to
 * same-origin browser clients. Never use Origin as authentication.
 */
const connectorOrigins = new Set([
  "https://claude.ai",
  "https://chatgpt.com",
  "https://chat.openai.com",
]);

export function isAllowedMcpOrigin(origin: string | null, siteOrigin: string): boolean {
  // Server-to-server clients normally omit Origin entirely.
  if (origin === null) return true;
  if (origin === "null") return false;
  return origin === new URL(siteOrigin).origin || connectorOrigins.has(origin);
}
