import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseOperation} from "../src/modules/platform/contracts.ts";

const uuid="94f0792a-18e6-40c0-a480-0be6d46dbb37";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("explanations are optional, validated and editable through shared REST/MCP operation schemas",()=>{
  const basic={title:"Question",prompt:"Which year?",answer:{canonical:"2003"},
    clues:[{type:"text",text:"A historical milestone"}]};
  assert.equal(parseOperation("quiz_create",basic).explanation,"");
  assert.equal(parseOperation("quiz_create",{...basic,explanation:"Historical context"}).explanation,"Historical context");
  assert.equal(parseOperation("quiz_update",{id:uuid,expectedVersion:1,explanation:"Updated"}).explanation,"Updated");
  assert.throws(()=>parseOperation("quiz_create",{...basic,explanation:"x".repeat(4001)}));
  assert.equal(parseOperation("quiz_translation_save",{
    id:uuid,locale:"en",sourceRevisionId:uuid,expectedVersion:0,
    fields:{...basic,explanation:"English explanation"}
  }).fields.explanation,"English explanation");
});

test("packs remain fully playable without sections, images, endings or score reviews",()=>{
  const bare=parseOperation("pack_create",{title:"A simple quiz pack",quizIds:[uuid]});
  assert.deepEqual(bare.sections,[]);
  assert.deepEqual(bare.scoreReviews,[]);
  assert.equal(bare.closingMessage,"");
  assert.equal(bare.coverMediaId,undefined);
});

test("optional chapter images and score commentary are accepted and validated in shared tools",()=>{
  const fields={title:"A historical figure",quizIds:[uuid],
    sections:[{start:1,title:"The early years",description:"Meet the person",mediaId:uuid}],
    closingMessage:"What their work means today",
    scoreReviews:[{minimumScore:0,title:"Thanks for trying"},{minimumScore:50,title:"Well done",description:"Keep exploring"}]};
  const created=parseOperation("pack_create",fields);
  assert.equal(created.sections[0].mediaId,uuid);
  assert.equal(created.scoreReviews.length,2);
  const updated=parseOperation("pack_update",{id:uuid,coverMediaId:uuid,sections:fields.sections,
    closingMessage:fields.closingMessage,scoreReviews:fields.scoreReviews});
  assert.equal(updated.coverMediaId,uuid);
  assert.throws(()=>parseOperation("pack_create",{...fields,sections:[{start:1,title:"",description:""}]}));
  assert.throws(()=>parseOperation("pack_create",{...fields,sections:[{start:1,title:"Chapter",mediaId:"broken"}]}));
  assert.throws(()=>parseOperation("pack_create",{...fields,closingMessage:"x".repeat(4001)}));
  assert.throws(()=>parseOperation("pack_create",{...fields,scoreReviews:[{minimumScore:-1,title:"Invalid"}]}));
});

test("chapter interstitials are outside rounds, while explanations and endings are result-only",()=>{
  const player=read("app/(platform)/play/page.tsx");
  assert.match(player,/play-chapter-intro/);
  assert.match(player,/!chapterIntro&&<section className="play-panel play-live"/);
  assert.match(player,/quizdip-chapter-viewed:/);
  assert.match(player,/isDone&&round\.explanation/);
  assert.match(player,/run\.mode==="PACK"&&pack\?\.closingMessage/);
  assert.match(player,/scoreReview/);
  const webSolo=read("app/(platform)/play/[quizId]/page.tsx");
  assert.match(webSolo,/status!=="ACTIVE"&&localQuestion\.current\?\.explanation/);
  const native=read("../../kids/app/game.tsx");
  assert.match(native,/ended&&question\.explanation/);
  const serverGuess=read("src/modules/platform/play.ts");
  assert.match(serverGuess,/correct \|\| failed \? \{ answer: answer\.canonical, explanation:/);
  const serverRound=read("src/modules/platform/runs.ts");
  assert.match(serverRound,/session\.status!=="ACTIVE"\?\{scoreThisQuestion:session\.score,explanation:/);
});

test("pack illustrations use private media ID ownership and are protected from deletion",()=>{
  const service=read("src/modules/platform/social.ts");
  assert.match(service,/checkPackCover\(p\.coverMediaId,user\.id\)/);
  assert.match(service,/checkChapterImages/);
  assert.match(service,/publicPackCover/);
  const media=read("src/modules/platform/media.ts");
  assert.match(media,/p\."coverMediaId" AS id/);
  assert.match(media,/chapter\.value ->> 'mediaId' AS id/);
});
