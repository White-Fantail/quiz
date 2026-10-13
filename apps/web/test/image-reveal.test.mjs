import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseOperation} from "../src/modules/platform/contracts.ts";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const mediaId="94f0792a-18e6-40c0-a480-0be6d46dbb37";
const base={title:"Whale reveal",prompt:"Guess the animal",answer:{canonical:"Blue Whale"}};
const make=(strength,effect="blur")=>({type:"image-reveal",mediaId,reveal:{effect,strength}});
test("one original image is accepted for multiple validated reveal stages",()=>{
  const quiz=parseOperation("quiz_create",{...base,clues:[make(95),make(55),make(0)]});
  assert.deepEqual(quiz.clues.map(c=>c.mediaId),[mediaId,mediaId,mediaId]);
  assert.deepEqual(quiz.clues.map(c=>c.reveal.strength),[95,55,0]);
  assert.equal(quiz.clues[0].reveal.focusX,50);
  assert.equal(quiz.clues[0].reveal.focusY,50);
  assert.equal(parseOperation("quiz_create",{...base,clues:[make(10,"zoom")]}).clues[0].reveal.effect,"zoom");
  assert.equal(parseOperation("quiz_create",{...base,clues:[make(10,"spotlight")]}).clues[0].reveal.effect,"spotlight");
});
test("invalid effects, strength, focus and remote images are rejected",()=>{
  for(const reveal of [
    {effect:"unknown",strength:40},{effect:"blur",strength:101},
    {effect:"blur",strength:-1},{effect:"blur",strength:4.3},
    {effect:"zoom",strength:80,focusX:999},
  ])assert.throws(()=>parseOperation("quiz_create",{...base,clues:[{type:"image-reveal",mediaId,reveal}]}));
  assert.throws(()=>parseOperation("quiz_create",{...base,clues:[{type:"image-reveal",mediaId:"https://example.com/image.png",reveal:{effect:"blur",strength:0}}]}));
});
test("web player and Studio retain each clue's text while updating a shared image in place",()=>{
  for(const path of ["app/(platform)/play/page.tsx","app/(platform)/play/[quizId]/page.tsx",
    "app/(creator)/studio/quizzes/[quizId]/preview/studio-quiz-preview.tsx"]){
    const page=read(path);
    assert.match(page,/activeImageStage/);
    assert.match(page,/clue\.text/);
    assert.match(page,/stage\?\.mediaId/);
    assert.doesNotMatch(page,/supersededReveal/);
  }
  const kidGame=read("../kids/app/game.tsx"),kidClue=read("../kids/src/components/KidClueView.tsx");
  assert.match(kidGame,/activeImageStage/);
  assert.match(kidGame,/mediaStage=\{stage\}/);
  assert.match(kidClue,/clue\.text/);
  assert.match(kidClue,/mediaStage\.mediaId/);
  assert.match(read("src/modules/platform/media.ts"),/clue\.type === "image-reveal" \? "image"/);
  assert.match(read("app/(creator)/studio/quizzes/[quizId]/quiz-detail.tsx"),/Create Image Reveal/);
});
test("Kids app supports the same reveal effects without duplicate media assets",()=>{
  assert.match(read("../kids/src/components/KidClueView.tsx"),/NativeImageReveal/);
  assert.match(read("../kids/src/components/KidClueView.tsx"),/blurRadius/);
  assert.match(read("../kids/src/components/KidClueView.tsx"),/spotlight/);
  assert.match(read("../kids/app/game.tsx"),/activeImageStage/);
});
