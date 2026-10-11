import Link from "next/link";

export default function HomePage() {
  return (
    <div className="container">
      <section className="hero">
        <div className="eyebrow">A LITTLE QUIZ. A LOT OF FUN.</div>
        <h1>단서를 따라,<br /><span className="purple">재미를 발견해.</span></h1>
        <p className="lead">정답을 몰라도 괜찮아. 힌트를 하나씩 열어 보며 추리하는 즐거움.<br />퀴즈를 풀고, 만들고, 함께 나누는 곳 — QuizDip.</p>
        <div className="actions">
          <Link className="btn btn-primary" href="/play">이번 주 5문제 도전하기 →</Link>
          <Link className="btn btn-outline" href="/studio">내 퀴즈 만들기</Link>
        </div>
        <div className="hero-stickers" aria-hidden="true"><span>?</span><span>✦</span><span>!</span></div>
      </section>
      <section className="section"><div className="note-strip"><b>이번 주의 출제자를 만나 보세요.</b><Link href="/play">모두가 같은 다섯 문제에 도전하기 →</Link></div>
        <h2>오늘은 뭘 발견할까?</h2>
        <p className="muted">QuizDip의 세 가지 시작점</p>
        <div className="cards">
          <Link href="/discover" className="feature-card"><span className="symbol mint">✧</span><h3>Discover</h3><p>동물, 인물, 지리, 과학. 호기심 가는 주제를 찾아봐.</p><span className="card-link">둘러보기 →</span></Link>
          <Link href="/play" className="feature-card"><span className="symbol yellow">?</span><h3>Play</h3><p>힌트를 하나씩 열어 정답을 알아내는 재미를 경험해 봐.</p><span className="card-link">시작하기 →</span></Link>
          <Link href="/studio" className="feature-card"><span className="symbol coral">✎</span><h3>Studio</h3><p>나만의 퀴즈를 만들고 다른 사람과 나눠봐.</p><span className="card-link">제작 공간 →</span></Link>
        </div>
      </section>
      <section className="note-strip"><b>Create it. Play it. Share it.</b><span>만들고, 풀고, 함께 즐겨.</span></section>
    </div>
  );
}
