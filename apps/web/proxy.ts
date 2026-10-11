import { NextResponse, type NextRequest } from "next/server";
import { isKidsPath } from "./src/modules/kids/navigation";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, localeFromAcceptLanguage, localeFromPath, stripLocale } from "./src/i18n/core";

function bypass(path: string): boolean {
  return path === "/api" || path.startsWith("/api/") ||
    path === "/_next" || path.startsWith("/_next/") ||
    path.startsWith("/.well-known/") ||
    path === "/favicon.ico" || path === "/robots.txt" || path === "/sitemap.xml" ||
    /\.[a-z0-9]+$/i.test(path);
}
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;
  if (bypass(pathname)) return NextResponse.next();
  const locale = localeFromPath(pathname);
  if (locale) {
    const headers = new Headers(request.headers);
    headers.set("x-quizdip-locale", locale);
    const resolvedPath = stripLocale(pathname);
    // Route-derived presentation shell: never honor a client-supplied shell header.
    headers.set("x-quizdip-shell", isKidsPath(resolvedPath) ? "kids" : "general");
    url.pathname = resolvedPath;
    const response = NextResponse.rewrite(url, { request: { headers } });
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/", maxAge: 31536000, sameSite: "lax", secure: request.nextUrl.protocol === "https:"
    });
    response.headers.set("Content-Language", locale);
    return response;
  }
  // Reject unsupported two-letter locale paths rather than silently serving different-language content.
  const selected = request.cookies.get(LOCALE_COOKIE)?.value;
  const fallback = isLocale(selected) ? selected : localeFromAcceptLanguage(request.headers.get("accept-language"));
  url.pathname = "/" + (fallback || DEFAULT_LOCALE) + (pathname === "/" ? "" : pathname);
  return NextResponse.redirect(url);
}
export const config = { matcher: "/:path*" };
