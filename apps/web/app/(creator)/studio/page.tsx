import Link from "next/link";

export default function StudioPage() {
  return (
    <section className="container inner-page compact">
      <span className="eyebrow">CLUPIO STUDIO</span>
      <h1>누구나 퀴즈 제작자!</h1>
      <p className="lead">만들고 싶은 퀴즈만 생각해 둬. 복잡한 설정 없이 제작하고 AI에게 도움받는 Studio를 준비하고 있어.</p>
      <div className="placeholder-panel">
        <h2>Studio는 개발 예정이에요</h2>
        <p>퀴즈 제작 UI는 준비 중이지만, 이미지·음원·영상은 지금 미디어 보관함에서 업로드할 수 있어요. 문제 등록과 단서 연결은 REST/MCP API를 통해 지원해요.</p>
        <div className="actions"><Link href="/studio/weekly" className="btn btn-primary">주간 출제자 도전하기</Link><Link href="/studio/media" className="btn btn-outline">미디어 보관함 열기</Link><Link href="/play" className="btn btn-outline">게임 먼저 체험하기</Link></div>
      </div>
    </section>
  );
}
