import Link from "next/link";

export default function StudioPage() {
  return (
    <section className="container inner-page compact">
      <span className="eyebrow">CLUPIO STUDIO</span>
      <h1>누구나 퀴즈 제작자!</h1>
      <p className="lead">만들고 싶은 퀴즈만 생각해 둬. 복잡한 설정 없이 제작하고 AI에게 도움받는 Studio를 준비하고 있어.</p>
      <div className="placeholder-panel">
        <h2>Studio는 개발 예정이에요</h2>
        <p>지금은 실제 저장·공개·AI 제작 기능이 없어요. 향후 웹 제작 도구와 ChatGPT/MCP 모두 동일한 콘텐츠 API를 사용해요.</p>
        <Link href="/play" className="btn btn-outline">게임 먼저 체험하기</Link>
      </div>
    </section>
  );
}
