import Link from "next/link";

const themes = [
  { title: "동물 맞히기", description: "생김새와 습성으로 추리해 봐.", icon: "🐬" },
  { title: "인물 맞히기", description: "인물의 삶과 업적에서 단서를 찾아봐.", icon: "🧩" },
  { title: "장소 맞히기", description: "지도와 문화 속으로 떠나는 탐험.", icon: "🌏" },
  { title: "과학과 사물", description: "익숙한 것들의 새로운 면을 발견해 봐.", icon: "🔬" },
];

export default function DiscoverPage() {
  return (
    <section className="container inner-page">
      <span className="eyebrow">CLUPIO DISCOVER</span>
      <h1>새로운 퀴즈를 발견해 봐</h1>
      <p className="muted">이 카테고리들은 앞으로 채워질 공간이에요. 지금은 샘플 퀴즈를 플레이할 수 있어요.</p>
      <div className="cards">
        {themes.map(({ title, description, icon }) => (
          <div className="feature-card" key={title}>
            <span className="symbol mint" aria-hidden="true">{icon}</span>
            <h2>{title}</h2><p>{description}</p>
            <span className="small-tag">준비 중</span>
          </div>
        ))}
      </div>
      <Link className="btn btn-primary" href="/play">샘플 퀴즈로 시작하기 →</Link>
    </section>
  );
}
