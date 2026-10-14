import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {answerShortcutIndex} from "../src/modules/platform/keyboard-choice.ts";

const base={altKey:false,ctrlKey:false,metaKey:false,shiftKey:false,repeat:false,isComposing:false};
const key=(value,extra={})=>({...base,key:value,...extra});

test("number row and numpad select the matching choice index",()=>{
  for(let number=1;number<=9;number++){
    assert.equal(answerShortcutIndex(key(String(number),{code:"Digit"+number})),number-1);
    assert.equal(answerShortcutIndex(key(String(number),{code:"Numpad"+number})),number-1);
  }
});

test("shortcuts do not steal modifiers, repeated keys, IME or navigation",()=>{
  for(const prop of ["ctrlKey","metaKey","altKey","shiftKey","repeat","isComposing"]){
    assert.equal(answerShortcutIndex(key("1",{[prop]:true})),null,prop);
  }
  for(const value of ["0","10","a","End","PageDown","Enter","!"]){
    assert.equal(answerShortcutIndex(key(value)),null,value);
  }
});

test("pack and single quiz use numbered choices, immediate submission and an in-flight guard",()=>{
  for(const file of ["app/(platform)/play/page.tsx","app/(platform)/play/[quizId]/page.tsx"]){
    const source=readFileSync(new URL("../"+file,import.meta.url),"utf8");
    assert.match(source,/className="guess-option-letter">\{index\+1\}/,file);
    assert.match(source,/answerShortcutIndex\(event\)/,file);
    assert.match(source,/setGuess\(option\);[\s\S]{0,160}void submitGuess\(option\)/,file);
    assert.match(source,/submittingRef\.current/,file);
    assert.match(source,/onSubmit=\{e\s*=>\s*\{e\.preventDefault\(\);void submitGuess\(guess\);\}\}/,file);
    assert.doesNotMatch(source,/String\.fromCharCode\(65\+index\)/,file);
  }
});
