import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { resolveLocale, localizeHref } from "../src/i18n/core";
import { t } from "../src/i18n/messages";
import { LocaleProvider } from "../src/i18n/provider";
import LanguageSwitcher from "../src/i18n/language-switcher";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  const kids = (await headers()).get("x-quizdip-shell") === "kids";
  if (kids) {
    const title = locale === "ko" ? "QuizDip Kids — 호기심 가득한 퀴즈 놀이터" : "QuizDip Kids — Explore and discover";
    const description = t(locale, "kids.meta");
    return { title, applicationName: "QuizDip Kids", description,
      openGraph: { title, description, siteName: "QuizDip Kids", type: "website" },
      twitter: { card: "summary", title, description } };
  }
  const description = t(locale, "meta.description");
  const title = locale === "ko" ? "QuizDip — 단서를 따라, 재미를 발견해" : "QuizDip — Follow the clues. Find the fun.";
  return {
    title, applicationName: "QuizDip",
    keywords: ["QuizDip", "quiz", "weekly quiz", "quiz creator", "퀴즈", "주간 퀴즈"],
    description,
    openGraph: { title, description, siteName: "QuizDip", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

const navLinks = [
  { href: "/discover", key: "nav.discover" },
  { href: "/play", key: "nav.play" },
  { href: "/studio", key: "nav.studio" },
  { href: "/kids", key: "nav.kids" },
  { href: "/account", key: "nav.account" },
] as const;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const locale = resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const kidsShell = requestHeaders.get("x-quizdip-shell") === "kids";
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale}>
          {kidsShell ? children : <>
          <header className="site-header">
            <div className="container header-inner">
              <Link href={localizeHref("/", locale)} className="wordmark" aria-label={t(locale, "nav.home")}>QuizDip<span className="wordmark-dot">.</span></Link>
              <nav aria-label={locale === "ko" ? "주요 메뉴" : "Main navigation"} className="nav">
                {navLinks.map(({ href, key }) => (
                  <Link key={href} href={localizeHref(href, locale)}>{t(locale, key)}</Link>
                ))}
              </nav>
              <LanguageSwitcher/>
            </div>
          </header>
          <main>{children}</main>
          <footer className="site-footer"><div className="container">© QuizDip · Create it. Play it. Share it.</div></footer>
          </>}
        </LocaleProvider>
      </body>
    </html>
  );
}
