import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("shared visual layout is used by Account, Studio and Admin screens",()=>{
 const roots=[
 "app/account/page.tsx","app/account/settings/page.tsx","app/account/kids/legacy-unlock/page.tsx",
 "app/admin/page.tsx","app/admin/quiz-review/page.tsx",
 "app/(creator)/studio/page.tsx","app/(creator)/studio/media/page.tsx",
 "app/(creator)/studio/quizzes/[quizId]/page.tsx"];
 for(const path of roots) assert.match(read(path),/className="[^"]*management-page[^"]*"/,path);
 for(const path of roots.filter(p=>p.includes("admin/")||p.includes("studio/")&&!p.includes("quizzes/")||p.includes("account/settings")))
   assert.match(read(path),/<ManagementHeader /,path);
 assert.match(read("app/admin/weekly/page.tsx"),/redirect\(localizeHref\("\/admin"/);
 assert.match(read("app/(creator)/studio/weekly/page.tsx"),/redirect\(localizeHref\("\/studio"/);
 assert.match(read("app/layout.tsx"),/import "\.\/management\.css";/);
 assert.match(read("src/components/management-header.tsx"),/<header className="management-heading">/);
});
test("management CSS is scoped and responsive",()=>{
 const css=read("app/management.css");
 assert.match(css,/\.management-page/);
 assert.match(css,/\.kids-settings-page/);
 assert.match(css,/input:not\(\[type="checkbox"\]\)/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(css,/\.management-page \.connected-provider/);
 assert.doesNotMatch(css,/\.guess-row/);
});
