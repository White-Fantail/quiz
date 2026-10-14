import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseOperation} from "../src/modules/platform/contracts.ts";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const mediaId="94f0792a-18e6-40c0-a480-0be6d46dbb37";
const base={title:"Whale reveal",prompt:"Guess the animal",answer:{canonical:"Blue Whale"}};
const make=(strength,effect="zoom")=>({type:"image-reveal",mediaId,reveal:{effect,strength}});

test("one original image is accepted for multiple validated reveal stages",()=>{
  const quiz=parseOperation("quiz_create",{...base,clues:[make(95),make(55),make(0)]});
  assert.deepEqual(quiz.clues.map(c=>c.mediaId),[mediaId,mediaId,mediaId]);
  assert.deepEqual(quiz.clues.map(c=>c.reveal.strength),[95,55,0]);
  assert.equal(quiz.clues[0].reveal.focusX,50);
  assert.equal(quiz.clues[0].reveal.focusY,50);
  assert.equal(parseOperation("quiz_create",{...base,clues:[make(10,"zoom")]}).clues[0].reveal.effect,"zoom");
  assert.equal(parseOperation("quiz_create",{...base,clues:[make(10,"spotlight")]}).clues[0].reveal.effect,"spotlight");
});

test("retired blur effects are rejected for create, update, replacement, and translation",()=>{
  const id=mediaId,clue=make(40,"blur");
  assert.throws(()=>parseOperation("quiz_create",{...base,clues:[clue]}));
  assert.throws(()=>parseOperation("quiz_update",{id,expectedVersion:1,clues:[clue]}));
  assert.throws(()=>parseOperation("clues_replace",{id,expectedVersion:1,clues:[clue]}));
  assert.throws(()=>parseOperation("quiz_translation_save",{
    id,locale:"ko",sourceRevisionId:id,expectedVersion:0,
    fields:{...base,clues:[clue]}
  }));
});

test("invalid strengths, focuses and remote images are rejected",()=>{
  for(const reveal of [
    {effect:"unknown",strength:40},{effect:"zoom",strength:101},
    {effect:"spotlight",strength:-1},{effect:"zoom",strength:4.3},
    {effect:"zoom",strength:80,focusX:999}
  ])assert.throws(()=>parseOperation("quiz_create",{...base,clues:[{type:"image-reveal",mediaId,reveal}]}));
  assert.throws(()=>parseOperation("quiz_create",{...base,clues:[
    {type:"image-reveal",mediaId:"https://example.com/image.png",reveal:{effect:"zoom",strength:0}}
  ]}));
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

test("web, Kids and Studio no longer offer an image blur effect",()=>{
  const kidClue=read("../kids/src/components/KidClueView.tsx");
  const webImage=read("src/components/image-reveal.tsx");
  const editor=read("app/(creator)/studio/quizzes/quiz-editor.tsx");
  const detail=read("app/(creator)/studio/quizzes/[quizId]/quiz-detail.tsx");
  assert.match(kidClue,/NativeImageReveal/);
  assert.match(kidClue,/reveal\.effect==="spotlight"/);
  assert.match(kidClue,/reveal\.effect==="zoom"/);
  assert.doesNotMatch(kidClue,/blurRadius|nativeRevealBlurRadius/);
  assert.doesNotMatch(webImage,/style\.filter|reveal\.effect==="blur"/);
  assert.doesNotMatch(editor,/<option value="blur">/);
  assert.doesNotMatch(detail,/<option value="blur">/);
});
