import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clupio — 단서를 따라, 재미를 발견해",
  description: "Follow the clues. Find the fun. 누구나 만들고 즐기는 열린 퀴즈 플랫폼.",
};

const navLinks = [
  { href: "/discover", label: "Discover" },
  { href: "/play", label: "Play" },
  { href: "/studio", label: "Studio" },
  { href: "/kids", label: "Kids" },
  { href: "/account", label: "내 계정" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="wordmark" aria-label="Clupio 홈">clupio<span className="wordmark-dot">.</span></Link>
            <nav aria-label="주요 메뉴" className="nav">
              {navLinks.map(({ href, label }) => (
                <Link key={href} href={href}>{label}</Link>
              ))}
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer"><div className="container">© Clupio · Create it. Play it. Share it.</div></footer>
      </body>
    </html>
  );
}
