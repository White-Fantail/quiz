import type { QuizQuestion } from "@clupio/domain";

/** Sample content only: this is not a published, moderated catalog item. */
export const demoQuiz: QuizQuestion = {
  id: "demo-dolphin",
  title: "바닷속 친구를 맞혀 봐!",
  mode: "guess-animal",
  prompt: "나는 누구일까요?",
  answer: { canonical: "돌고래", aliases: ["dolphin"] },
  clues: [
    { id: "clue-1", order: 1, type: "text", text: "나는 물속에서 생활하지만 물고기는 아니에요." },
    { id: "clue-2", order: 2, type: "text", text: "숨을 쉬려면 물 위로 올라와야 해요." },
    { id: "clue-3", order: 3, type: "text", text: "똑똑하고 무리를 지어 살아요." },
    { id: "clue-4", order: 4, type: "text", text: "바다에서 점프하는 모습으로도 유명해요. 영어 이름은 Dolphin!" },
  ],
  creatorIntent: { ageRange: { minimum: 6 } },
  recommendedAudience: { ageRange: { minimum: 6 }, difficulty: "easy" },
  publication: "draft",
  platformSafety: { status: "pending" },
};
