import test from "node:test";
import assert from "node:assert/strict";
import { activeImageStage,spotlightRevealRadiusPercent,spotlightRevealRadiusPixels } from "../src/image-clues.ts";

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

test("spotlight starts with a genuinely small detail and expands consistently in web and native",()=>{
  const strengths=[100,95,87,65,40,10,0];
  const percentages=strengths.map(spotlightRevealRadiusPercent);
  for(let i=1;i<percentages.length;i++)
    assert.ok(percentages[i]>=percentages[i-1], "lower strength should never show less");
  assert.ok(percentages[2]<6, "87 strength must uncover under 6% of the normalized diagonal");
  assert.ok(percentages[3]>percentages[2]*3, "the next stage must meaningfully expand");
  assert.equal(spotlightRevealRadiusPercent(0),100);
  assert.equal(spotlightRevealRadiusPercent(NaN),2);
  assert.equal(spotlightRevealRadiusPercent(200),2);
  assert.equal(spotlightRevealRadiusPercent(-10),100);

  // Dimensions from the iPad example: the original native radius was ~197px.
  const radius=spotlightRevealRadiusPixels(87,650,240);
  assert.ok(radius>=20&&radius<30, "the first 87-strength clue should reveal a ~23px radius");
  assert.ok(Math.abs(radius-percentages[2]/100*Math.hypot(650,240)/Math.SQRT2)<1e-10);
  assert.equal(spotlightRevealRadiusPixels(87,0,0),0);
  assert.equal(spotlightRevealRadiusPixels(87,NaN,Infinity),0);
});
