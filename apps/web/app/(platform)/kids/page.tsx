import Link from "next/link";

export default function KidsPage() {
  return (
    <section className="container inner-page compact">
      <span className="eyebrow">CLUPIO KIDS</span>
      <h1>작은 호기심, 큰 발견</h1>
      <p className="lead">Clupio Kids는 별도의 플랫폼이 아니라 어린이를 위한 안전한 경험 모드야.</p>
      <div className="placeholder-panel">
        <h2>Kids 모드 준비 중</h2>
        <p>아직 자동 안전성 심사와 어린이 전용 콘텐츠 노출 기능은 구현되지 않았어요. 안전성이 확인되지 않은 샘플을 어린이용 콘텐츠로 표시하지 않아요.</p>
        <Link href="/" className="btn btn-outline">홈으로 돌아가기</Link>
      </div>
    </section>
  );
}
