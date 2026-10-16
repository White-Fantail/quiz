import { NextResponse,type NextRequest } from "next/server";
import { KIDS_COOKIE } from "./src/modules/kids/constants";
import { DEFAULT_LOCALE,LOCALE_COOKIE,isLocale,localeFromAcceptLanguage,localeFromPath,stripLocale } from "./src/i18n/core";

function bypass(path:string):boolean {
 // OG images are public binary assets. Do not redirect Facebook's image bot
 // through the locale chooser; it needs a direct 200 image/png response.
 if(/^\/results\/[^/]+\/og$/.test(path))return true;
 return path==="/api"||path.startsWith("/api/")||
   path==="/_next"||path.startsWith("/_next/")||
   path.startsWith("/.well-known/")||
   path==="/favicon.ico"||path==="/robots.txt"||path==="/sitemap.xml"||
   /\.[a-z0-9]+$/i.test(path);
}
const LEGACY_GATE="/account/kids/legacy-unlock";
const retired=(path:string)=>path==="/kids"||path.startsWith("/kids/");
export function proxy(request:NextRequest){
 const url=request.nextUrl.clone(),pathname=url.pathname;
 if(bypass(pathname))return NextResponse.next();
 const locked=request.cookies.has(KIDS_COOKIE);
 const localeFromUrl=localeFromPath(pathname);
 if(localeFromUrl){
   const locale=localeFromUrl;
   const resolvedPath=stripLocale(pathname);
   // Retired Kids URLs never serve an old game and must not rewrite into its UI.
   if(locked && resolvedPath!==LEGACY_GATE){
     url.pathname="/"+locale+LEGACY_GATE;
     url.search="";
     return NextResponse.redirect(url,307);
   }
   if(retired(resolvedPath)){
     url.pathname="/"+locale+"/account/kids";
     url.search="";
     return NextResponse.redirect(url,307);
   }
   const nextHeaders=new Headers(request.headers);
   nextHeaders.set("x-quizdip-locale",locale);
   nextHeaders.set("x-quizdip-legacy-lock",locked?"locked":"general");
   nextHeaders.delete("x-quizdip-shell");
   nextHeaders.delete("x-quizdip-path");
   url.pathname=resolvedPath;
   const response=NextResponse.rewrite(url,{request:{headers:nextHeaders}});
   response.cookies.set(LOCALE_COOKIE,locale,{
     path:"/",maxAge:31536000,sameSite:"lax",secure:request.nextUrl.protocol==="https:"
   });
   response.headers.set("Content-Language",locale);
   return response;
 }
 const selected=request.cookies.get(LOCALE_COOKIE)?.value;
 const fallback=isLocale(selected)?selected:localeFromAcceptLanguage(request.headers.get("accept-language"));
 url.pathname="/"+(fallback||DEFAULT_LOCALE)+(locked?LEGACY_GATE:
   retired(pathname)?"/account/kids":pathname==="/"? "":pathname);
 if(locked||retired(pathname))url.search="";
 return NextResponse.redirect(url,307);
}
export const config={matcher:"/:path*"};
