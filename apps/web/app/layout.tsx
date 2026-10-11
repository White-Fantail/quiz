import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuizDip — 단서를 따라, 재미를 발견해",
  applicationName: "QuizDip",
  keywords: ["QuizDip", "quiz", "weekly quiz", "quiz creator", "퀴즈", "주간 퀴즈"],
  openGraph: { title: "QuizDip — 단서를 따라, 재미를 발견해", description: "Create, play and share quizzes. 매주 다섯 문제에 도전하고 나만의 퀴즈를 만들어 보세요.", siteName: "QuizDip", type: "website" },
  description: "QuizDip — Create, play and share quizzes. 매주 다섯 문제에 도전하고 나만의 퀴즈를 만들어 보세요.",
  twitter: { card: "summary", title: "QuizDip — A little quiz. A lot of fun.", description: "Create, play and share quizzes." },
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
            <Link href="/" className="wordmark" aria-label="QuizDip 홈">clupio<span className="wordmark-dot">.</span></Link>
            <nav aria-label="주요 메뉴" className="nav">
              {navLinks.map(({ href, label }) => (
                <Link key={href} href={href}>{label}</Link>
              ))}
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer"><div className="container">© QuizDip · Create it. Play it. Share it.</div></footer>
      </body>
    </html>
  );
}
