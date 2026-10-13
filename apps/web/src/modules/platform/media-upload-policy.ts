import type { Actor } from "./auth";

/** Daily-count exemptions are granted only by the server-resolved account role. */
export function isExemptFromDailyMediaLimit(actor: Pick<Actor, "role">): boolean {
  return actor.role === "ADMIN";
}
