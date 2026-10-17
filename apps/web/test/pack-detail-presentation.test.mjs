import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { splitPackDescription } from "../src/modules/quiz/pack-description.ts";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("pack descriptions separate explicit image attribution while preserving creator prose", () => {
  const description = "A thoughtful introduction.\n\nFive chapters cover the journey.\n\n이미지 출처: 표지—공공누리 제1유형; 1부—CC BY-SA 3.0.";
  assert.deepEqual(splitPackDescription(description), {
    intro:"A thoughtful introduction.\n\nFive chapters cover the journey.",
    imageCredits:"이미지 출처: 표지—공공누리 제1유형; 1부—CC BY-SA 3.0."
  });
  assert.deepEqual(splitPackDescription("Intro\n\nImage credits: photo A\n\nPhoto source: photo B"), {
    intro:"Intro",imageCredits:"Image credits: photo A\n\nPhoto source: photo B"
  });
  assert.deepEqual(splitPackDescription("Intro\n\nHistoric sources support this account."),{
    intro:"Intro\n\nHistoric sources support this account.",imageCredits:""
  });
  assert.deepEqual(splitPackDescription(""),{intro:"",imageCredits:""});
});

test("public pack details show chapter count without previewing chapter images or narrative",()=>{
  const page=read("app/(platform)/packs/[packId]/page.tsx");
  const play=read("app/(platform)/play/page.tsx");
  assert.match(page,/pack\.sections\.length>0/);
  assert.doesNotMatch(page,/pack-section-overview|pack\.sections\.map/);
  assert.match(play,/play-chapter-intro/);
  assert.match(play,/chapterIntro\.description/);
  assert.match(play,/chapterIntro\.mediaUrl/);
  assert.match(page,/details className="pack-image-credits"/);
  assert.match(page,/\{imageCredits&&<details/);
  assert.match(page,/splitPackDescription\(pack\.description\|\|""\)/);
});

test("answer/explanation spacing applies only to optional result explanation",()=>{
  const css=read("app/globals.css");
  const player=read("app/(platform)/play/page.tsx");
  assert.match(css,/\.play-live \.quiz-answer-explanation \{ margin-top:18px; \}/);
  assert.match(player,/isDone&&round\.explanation&&<section className="feature-card quiz-answer-explanation"/);
});
