import { randomBytes, createHash, scryptSync, timingSafeEqual } from "node:crypto";

/** Tokens are random capabilities, persisted only by hash; PINs are salted and memory-hard. */
import { KIDS_COOKIE } from "./constants";
export { KIDS_COOKIE, MAX_DEVICE_AGE_SECONDS } from "./constants";

export function validPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^[0-9]{6}$/.test(pin);
}
export function hashPin(pin: string): string {
  if (!validPin(pin)) throw new Error("Invalid guardian PIN");
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(pin, Buffer.from(salt,"hex"), 64).toString("hex");
  return salt + ":" + derived;
}
export function checkPin(pin: string, stored: string): boolean {
  if (!validPin(pin)) return false;
  const [salt, hex] = stored.split(":");
  if (!salt || !hex || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) return false;
  const expected = Buffer.from(hex, "hex");
  const actual = scryptSync(pin, Buffer.from(salt,"hex"), 64);
  return timingSafeEqual(actual, expected);
}
export function newDeviceToken(): string { return randomBytes(32).toString("base64url"); }
export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export function readCookie(header: string | null, name = KIDS_COOKIE): string | null {
  const item = (header ?? "").split(";").map(s => s.trim()).find(s => s.startsWith(name + "="));
  if (!item) return null;
  const value = item.slice(name.length + 1);
  return /^[A-Za-z0-9_-]{40,90}$/.test(value) ? value : null;
}
export function hasKidCookie(header: string | null): boolean {
  return (header ?? "").split(";").some(s => s.trim().startsWith(KIDS_COOKIE + "="));
}
