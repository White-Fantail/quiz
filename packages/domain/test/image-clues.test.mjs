import test from "node:test";
import assert from "node:assert/strict";
import { activeImageStage } from "../src/image-clues.ts";

const frog = "frog-image", owl = "owl-image";
const sequence = [
  {type:"image-reveal",mediaId:frog,text:"Who is hiding?",reveal:{effect:"blur",strength:24}},
  {type:"image",mediaId:frog,text:"Ribbit! I can jump and hop!"}
];

test("a later plain image updates the first blurred photo in place",()=>{
  assert.equal(activeImageStage(sequence.slice(0,1),0)?.reveal?.strength,24);
  assert.equal(activeImageStage(sequence,0),sequence[1]);
  assert.equal(activeImageStage(sequence,1),null);
  assert.equal(sequence[0].text,"Who is hiding?");
  assert.equal(sequence[1].text,"Ribbit! I can jump and hop!");
});

test("blur / zoom / spotlight sequences share the first image slot",()=>{
  const stages=[{type:"image-reveal",mediaId:frog,reveal:{effect:"blur",strength:95}},
    {type:"image-reveal",mediaId:frog,reveal:{effect:"blur",strength:55}},
    {type:"image-reveal",mediaId:frog,reveal:{effect:"blur",strength:0}}];
  for(const count of [1,2,3]){
    const revealed=stages.slice(0,count);
    assert.equal(activeImageStage(revealed,0),stages[count-1]);
    for(let i=1;i<count;i++)assert.equal(activeImageStage(revealed,i),null);
  }
});

test("unrelated images and non-image clues remain separate",()=>{
  const clues=[
    {type:"image-reveal",mediaId:frog},
    {type:"text",text:"It jumps"},
    {type:"image",mediaId:owl},
    {type:"audio",mediaId:frog},
    {type:"image",mediaId:frog}
  ];
  assert.equal(activeImageStage(clues,0),clues[4]);
  assert.equal(activeImageStage(clues,1),clues[1]);
  assert.equal(activeImageStage(clues,2),clues[2]);
  assert.equal(activeImageStage(clues,3),clues[3]);
  assert.equal(activeImageStage(clues,4),null);
  assert.equal(activeImageStage([],0),null);
});
