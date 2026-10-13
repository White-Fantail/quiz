import type { Actor } from "./auth";

/** Only the authenticated MCP handler may set trustedMcpRequest. */
export function isTrustedMcpAdmin(actor: Actor | null): boolean {
  return actor?.role === "ADMIN" && actor.trustedMcpRequest === true && !actor.childScope;
}
