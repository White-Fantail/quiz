export type AnswerType = "person" | "animal" | "place" | "thing" | "event" | "concept" | "other";
export type TopicSummary = { id?: string; key?: string; name: string; isSpoiler?: boolean };
export type Audience = {
  ageRange?: { minimum?: number; maximum?: number };
  difficulty?: "easy" | "medium" | "hard";
} | null;
export type DiscoverQuiz = {
  id: string;
  title: string;
  prompt: string;
  mode: string;
  answerType: AnswerType;
  topics: TopicSummary[];
  clueCount: number;
  recommendedAudience: Audience;
  kidsEligible: boolean;
};
export const ANSWER_TYPES: { value: AnswerType; label: string; icon: string }[] = [
  { value: "animal", label: "동물", icon: "🐬" },
  { value: "person", label: "인물", icon: "🧩" },
  { value: "place", label: "장소", icon: "🌏" },
  { value: "thing", label: "사물", icon: "🔎" },
  { value: "event", label: "사건", icon: "📜" },
  { value: "concept", label: "개념", icon: "💡" },
  { value: "other", label: "기타", icon: "✨" }
];
export function publicTopics(quiz: Pick<DiscoverQuiz, "topics">): TopicSummary[] {
  return (quiz.topics ?? []).filter(topic => topic.isSpoiler !== true);
}
export function discoverQuery(filters: {
  answerType?: string; topic?: string; kids: boolean; offset: number; limit: number;
}): string {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit));
  params.set("offset", String(filters.offset));
  if (filters.answerType) params.set("answerType", filters.answerType);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.kids) params.set("kids", "true");
  return params.toString();
}
export function audienceAgeLabel(audience: Audience): string | null {
  const min = audience?.ageRange?.minimum;
  const max = audience?.ageRange?.maximum;
  if (min === undefined && max === undefined) return null;
  if (min !== undefined && max !== undefined) return min === max ? min + "세 추천" : min + "–" + max + "세 추천";
  return min !== undefined ? min + "세 이상 추천" : max + "세 이하 추천";
}
export function difficultyLabel(audience: Audience): string | null {
  const labels = { easy: "쉬움", medium: "보통", hard: "어려움" };
  return audience?.difficulty ? labels[audience.difficulty] : null;
}
export function modeLabel(mode: string): string {
  return mode === "progressive-clues" ? "단계별 단서" : "퀴즈";
}
