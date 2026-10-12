"use client";

// Deduplicate the relatively expensive, public ranking query across the
// pack spotlight and the general discovery lanes during the same page load.
// Keep no settled cache so publication and moderation changes take effect.
const inFlight = new Map<string, Promise<any>>();

export function loadDiscoverySections(locale: "en" | "ko"): Promise<any> {
  const existing = inFlight.get(locale);
  if (existing) return existing;
  const request = fetch("/api/v1/discover/sections?locale=" + locale, { cache: "no-store" })
    .then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || body.error || "Discovery unavailable");
      return body.data;
    });
  inFlight.set(locale, request);
  void request.then(
    () => { if (inFlight.get(locale) === request) inFlight.delete(locale); },
    () => { if (inFlight.get(locale) === request) inFlight.delete(locale); }
  );
  return request;
}
