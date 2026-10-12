/** Explicit, exact-host allowlist for media imports.
 * These image CDN hosts are reviewed defaults; admins may add further exact hosts
 * through MEDIA_IMPORT_HOSTS. No wildcards, suffix matching or arbitrary URLs.
 */
export const CURATED_IMAGE_IMPORT_HOSTS = [
  "upload.wikimedia.org",
  "images.unsplash.com",
  "images.pexels.com",
  "cdn.pixabay.com",
] as const;

export function mediaImportHostAllowed(
  hostname: string, kind: "image" | "audio" | "video",
  configuredHosts: string | undefined = process.env.MEDIA_IMPORT_HOSTS,
): boolean {
  const exactHostname = hostname.toLowerCase();
  if (kind === "image" && CURATED_IMAGE_IMPORT_HOSTS.some(host => host === exactHostname)) return true;
  const configured = (configuredHosts || "").split(",").map(host => host.trim().toLowerCase());
  return configured.some(host => host.length > 0 && /^[a-z0-9.-]+$/.test(host) && host === exactHostname);
}
