import Link from "next/link";

export default function KidsPage() {
  return (
    <section className="container inner-page compact">
      <span className="eyebrow">CLUPIO KIDS</span>
      <h1>작은 호기심, 큰 발견</h1>
      <p className="lead">Clupio Kids는 별도의 플랫폼이 아니라 어린이를 위한 안전한 경험 모드야.</p>
      <div className="placeholder-panel">
        <h2>안전한 어린이 퀴즈</h2>
        <p>어린이용으로 승인된 퀴즈만 보여줘요. 주간 5문제와 랜덤·무한 플레이를 즐길 수 있어요. 자동 안전성 심사는 아직 준비 중이며, 승인된 콘텐츠가 없으면 플레이할 수 없어요.</p>
        <div className="actions"><Link href="/play" className="btn btn-primary">어린이 플레이 선택하기</Link><Link href="/" className="btn btn-outline">홈으로 돌아가기</Link></div>
      </div>
    </section>
  );
}
