import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseOperation,operations} from "../src/modules/platform/contracts.ts";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const id="11111111-1111-4111-8111-111111111111";

test("admin media queue is registered, paginated and filtered",()=>{
  const op=operations.admin_media_review_list;
  assert.equal(op.public,false);
  assert.deepEqual(
    (({moderation,kind,search,limit,offset})=>({moderation,kind,search,limit,offset}))(parseOperation("admin_media_review_list",{})),
    {moderation:"PENDING",kind:"all",search:"",limit:20,offset:0}
  );
  assert.equal(parseOperation("admin_media_review_list",{moderation:"RESTRICTED",kind:"video"}).kind,"video");
  assert.throws(()=>parseOperation("admin_media_review_list",{moderation:"UPLOADING"}));
  assert.throws(()=>parseOperation("admin_media_review_list",{limit:101}));
  assert.throws(()=>parseOperation("admin_media_review_list",{offset:-1}));
  const routes=read("app/api/v1/[...segments]/route.ts");
  const dispatch=read("src/modules/platform/operations.ts");
  assert.match(routes,/op:"admin_media_review_list"/);
  assert.match(dispatch,/case "admin_media_review_list": return adminMediaReviewList/);
});

test("admin media list is role-restricted and doesn't expose signed previews in results",()=>{
  const source=read("src/modules/platform/media.ts");
  const start=source.indexOf("export async function adminMediaReviewList(");
  const end=source.indexOf("export async function mediaReview(",start);
  const handler=source.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(handler,/user.role !== "ADMIN"/);
  assert.match(handler,/deletedAt: null, status: "READY"/);
  assert.match(handler,/include:\{owner:\{select:\{displayName:true\}\}\}/);
  assert.doesNotMatch(handler,/previewUrl\(/);
  assert.match(source,/export async function mediaReviewGet/);
});

test("media approval is instant with no reason, rejection requires a reason at the API boundary",()=>{
  assert.equal(parseOperation("media_review",{id,verdict:"APPROVED",confirm:true}).reason,"");
  assert.throws(()=>parseOperation("media_review",{id,verdict:"RESTRICTED",confirm:true}));
  assert.throws(()=>parseOperation("media_review",{id,verdict:"RESTRICTED",confirm:true,reason:"bad"}));
  assert.equal(parseOperation("media_review",{id,verdict:"RESTRICTED",confirm:true,reason:"unsafe image"}).reason,"unsafe image");
  const ui=read("app/admin/media-review/media-review-console.tsx");
  assert.match(ui,/verdict:"APPROVED",confirm:true/);
  assert.match(ui,/verdict:"RESTRICTED",reason:reason.trim\(\),confirm:true/);
  assert.match(ui,/reason.trim\(\).length<5/);
  assert.match(ui,/onClick=\{approve\}/);
  assert.match(ui,/onClick=\{\(\)=>void approveSelected\(\)\}/);
});

test("media review page is admin-only and linked from dashboard",()=>{
  const admin=read("app/admin/page.tsx");
  const page=read("app/admin/media-review/page.tsx");
  assert.match(admin,/href=\{localizeHref\("\/admin\/media-review",locale\)\}/);
  assert.match(page,/if \(actor.role !== "ADMIN"\) notFound\(\)/);
  assert.match(page,/MediaReviewConsole/);
});
