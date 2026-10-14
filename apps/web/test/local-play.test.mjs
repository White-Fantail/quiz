import test from "node:test";
import assert from "node:assert/strict";
import {initialLocalProgress,revealLocalClue,guessLocalAnswer,localSummary} from "../../../packages/domain/src/local-play.ts";
import {parseOperation} from "../src/modules/platform/contracts.ts";

const q={quizId:"00000000-0000-4000-8000-000000000001",revisionId:"rev",
 title:"Local quiz",prompt:"What?",promptMediaIds:[],
 clues:[{type:"text",text:"Clue 1"},{type:"text",text:"Clue 2"},{type:"text",text:"Clue 3"}],
 answer:{canonical:"고양이",aliases:["cat"],responseMode:"text"}};
test("local clues and guesses are deterministic without network",()=>{
 const initial=initialLocalProgress();
 const wrong=guessLocalAnswer(q,initial,"dog");
 assert.equal(wrong.result.status,"ACTIVE");
 assert.equal(wrong.progress.mustReveal,true);
 assert.equal(guessLocalAnswer(q,wrong.progress,"cat"),null);
 const next=revealLocalClue(q,wrong.progress);
 assert.equal(next.clueIndex,2);
 assert.equal(next.mustReveal,false);
 const solved=guessLocalAnswer(q,next," CAT ");
 assert.equal(solved.result.correct,true);
 assert.equal(solved.progress.status,"SOLVED");
 assert.equal(solved.progress.score,60);
 assert.equal(revealLocalClue(q,solved.progress),solved.progress);
});
test("last wrong guess ends a question and score summaries ignore active rounds",()=>{
 let progress=initialLocalProgress();
 progress=revealLocalClue(q,revealLocalClue(q,progress));
 const failed=guessLocalAnswer(q,progress,"dog");
 assert.equal(failed.progress.status,"FAILED");
 assert.equal(failed.progress.score,0);
 assert.deepEqual(localSummary([failed.progress,initialLocalProgress()]),{
   completed:1,score:0,solved:0,failed:1
 });
});
test("authored multiple-choice retains lower scoring and ignores answers not in choices",()=>{
 const question={...q,answer:{canonical:"A",aliases:[],responseMode:"multiple-choice",options:["A","B","C"]}};
 assert.equal(guessLocalAnswer(question,initialLocalProgress(),"D"),null);
 const result=guessLocalAnswer(question,initialLocalProgress(),"A");
 assert.equal(result.progress.score,75);
});
test("finite local play bundle and sync are available through common operation registry",()=>{
 const runId="00000000-0000-4000-8000-000000000001";
 const runToken="x".repeat(40);
 assert.equal(parseOperation("local_run_bundle",{runId,runToken}).runId,runId);
 assert.equal(parseOperation("local_run_sync",{runId,runToken,results:[{
   position:0,cluesUsed:2,status:"SOLVED",score:60
 }]}).results[0].score,60);
 assert.throws(()=>parseOperation("local_run_sync",{runId,runToken,results:[{
   position:-1,cluesUsed:2,status:"SOLVED",score:60
 }]}));
});
