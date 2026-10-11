import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { operations, parseOperation } from "../src/modules/platform/contracts.ts";

const load = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const id = "94f0792a-18e6-40c0-a480-0be6d46dbb37";
const hash = "a".repeat(64);

test("media operations exist for REST and are included in MCP shared tool registry", () => {
  const names = ["media_upload","media_chunk","media_complete","media_import","media_list",
    "media_get","media_update","media_delete","media_transform","media_review","play_media"];
  const rest = load("app/api/v1/[...segments]/route.ts");
  const mcp = load("app/api/mcp/route.ts");
  const dispatch = load("src/modules/platform/operations.ts");
  for (const name of names) {
    assert.ok(name in operations, name);
    assert.ok(rest.includes(`op: "${name}"`), "REST missing: " + name);
    assert.ok(dispatch.includes(`case "${name}"`), "Dispatch missing: " + name);
  }
  assert.match(mcp, /Object\.keys\(operations\)/);
});

test("typed multimodal clue references are IDs, not arbitrary remote URL", () => {
  const base = { title:"animal", prompt:"Guess", mode:"progressive-clues",answerType:"animal",
    answer:{canonical:"zebra"}, clues:[{type:"image",mediaId:id}] };
  assert.equal(parseOperation("quiz_create",base).clues[0].mediaId,id);
  assert.throws(()=>parseOperation("quiz_create",{...base,clues:[{type:"audio",media:{url:"https://untrusted.test/a.mp3"}}]}));
  assert.throws(()=>parseOperation("quiz_create",{...base,promptMediaIds:Array(6).fill(id)}));
  assert.equal(parseOperation("quiz_create",{...base,promptMediaIds:[id]}).promptMediaIds[0],id);
});

test("media upload contracts enforce digest and format; chunked fallback bounded", () => {
  const valid = { kind:"image",mimeType:"image/png",filename:"zebra.png",sizeBytes:120,sha256:hash };
  assert.equal(parseOperation("media_upload",valid).kind,"image");
  assert.throws(()=>parseOperation("media_upload",{...valid,mimeType:"application/x-msdownload"}));
  assert.throws(()=>parseOperation("media_upload",{...valid,sha256:"bad"}));
  assert.equal(parseOperation("media_chunk",{id,index:0,sha256:hash,dataBase64:"dGVzdA=="}).index,0);
  assert.throws(()=>parseOperation("media_chunk",{id,index:128,sha256:hash,dataBase64:"dGVzdA=="}));
  assert.throws(()=>parseOperation("media_complete",{id,partCount:129}));
  assert.throws(()=>parseOperation("media_delete",{id}));
  assert.throws(()=>parseOperation("media_review",{id,verdict:"APPROVED",reason:"manually checked"}));
});

test("private storage, owned media, version-pinned reveal and admin review are server-enforced", () => {
  const storage = load("src/modules/platform/storage.ts");
  const media = load("src/modules/platform/media.ts");
  const quiz = load("src/modules/platform/quiz.ts");
  assert.match(storage,/R2_ENDPOINT/);
  assert.match(storage,/getSignedUrl/);
  assert.match(media,/checksum_mismatch/);
  assert.match(media,/await putObject\(item.storageKey, bytes, item.mimeType\)/);
  assert.match(storage,/blockedIp/);
  assert.match(storage,/MEDIA_IMPORT_HOSTS/);
  assert.match(storage,/readChunks/);
  assert.match(media,/ownerId:\s*user\.id/);
  assert.match(media,/checksum_mismatch/);
  assert.match(media,/getPlaySession/);
  assert.match(media,/usedClues/);
  assert.match(media,/moderationStatus\s*!==\s*"APPROVED"/);
  assert.match(media,/user\.role\s*!==\s*"ADMIN"/);
  assert.match(quiz,/validateMediaReferences/);
  assert.match(quiz,/currentRevision/);
});

test("Studio media library uses the same REST endpoints as MCP without separate storage logic", () => {
  const studio = load('app/(creator)/studio/media/media-library.tsx');
  const page = load('app/(creator)/studio/media/page.tsx');
  assert.match(studio, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(studio, /api\("\/media\/upload"/);
  assert.match(studio, /"\/complete"/);
  assert.match(studio, /fetch\(ticket\.upload\.url/);
  assert.match(studio, /"\/transform"/);
  assert.match(page, /auth\.api\.getSession/);
});

test("admin media preview is distinct from owner asset edit and delete",()=>{
  const media=load("src/modules/platform/media.ts");
  assert.match(media,/export async function mediaReviewGet/);
  assert.match(media,/user\.role!=="ADMIN"/);
  assert.match(media,/previewExpiresInSeconds:60/);
});
