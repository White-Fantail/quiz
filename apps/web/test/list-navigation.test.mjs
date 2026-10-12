import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {listHref,listPageIndex} from "../src/lib/list-url-state.ts";
import {listBackHref} from "../src/lib/list-back-href.ts";

test("list page numbers are one-based, validated and bounded",()=>{
  assert.equal(listPageIndex("1"),0);
  assert.equal(listPageIndex("3"),2);
  assert.equal(listPageIndex("999999",100),100);
  for(const page of ["0","-1","1abc","Infinity","NaN","99999999999999999999"]){
    assert.equal(listPageIndex(page),0,page);
  }
});

test("list links preserve only changed filters and do not leak arbitrary return URLs",()=>{
  const defaults={q:"",page:"1",sort:"newest"};
  assert.equal(listHref("/ko/studio", {q:"cat & dog",page:"3",sort:"newest"},defaults),
    "/ko/studio?q=cat+%26+dog&page=3");
  const detailQuery={q:"cat & dog",page:"3",returnTo:"https://evil.example",sort:["oldest","newest"]};
  assert.equal(listBackHref("/ko/studio",detailQuery,["q","page","sort"]),
    "/ko/studio?q=cat+%26+dog&page=3");
});

test("all navigable list screens own URL state, and details keep allowlisted list context",()=>{
  const read=(path)=>readFileSync(new URL("../app/"+path,import.meta.url),"utf8");
  const listScreens=[
    "admin/quiz-review/review-console.tsx",
    "admin/packs-review/pack-safety-console.tsx",
    "(creator)/studio/studio-workspace.tsx",
    "(creator)/studio/packs/pack-workspace.tsx",
    "(creator)/studio/media/media-library.tsx",
    "(platform)/discover/page.tsx"
  ];
  for(const screen of listScreens){
    const source=read(screen);
    assert.match(source,/useListUrlState\(/,screen);
    assert.match(source,/listPageIndex\(/,screen);
  }
  const discover=read("(platform)/discover/page.tsx");
  assert.match(discover,/packPage/);
  assert.match(read("(platform)/discover/pack-browser.tsx"),/onPageChange/);
  const review=read("admin/quiz-review/review-console.tsx");
  assert.match(review,/queue,q:query,page:String\(page\)/);
  for(const path of [
    "(creator)/studio/quizzes/[quizId]/page.tsx",
    "(creator)/studio/quizzes/[quizId]/edit/page.tsx",
    "(creator)/studio/quizzes/[quizId]/preview/page.tsx",
    "(creator)/studio/packs/[packId]/page.tsx",
    "(platform)/packs/[packId]/page.tsx"
  ])assert.match(read(path),/listBackHref\(/,path);
});
