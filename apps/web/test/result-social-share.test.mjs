import assert from "node:assert/strict";
import test from "node:test";
import { publicResultSharePayload } from "../src/lib/result-social-share.ts";

const resultUrl = "https://quizdip.vercel.app/ko/results/123e4567-e89b-12d3-a456-426614174000";
const packUrl = "https://quizdip.vercel.app/ko/packs/123e4567-e89b-12d3-a456-426614174000";

test("Facebook shares the public result URL alone so OG metadata supplies the image", () => {
  assert.deepEqual(publicResultSharePayload("facebook", resultUrl, "Test pack", "My score"), {
    url: resultUrl,
  });
});

test("X includes score text and the result URL", () => {
  assert.deepEqual(publicResultSharePayload("x", resultUrl, "Test pack", "My score"), {
    title: "Test pack · QuizDip",
    text: "My score",
    url: resultUrl,
  });
});

test("never silently replace the result with a pack or homepage URL", () => {
  for (const url of ["", packUrl, "https://quizdip.vercel.app/", "javascript:alert(1)", "not a URL"]) {
    assert.throws(() => publicResultSharePayload("facebook", url, "Title", "Text"));
  }
});

test("accept both localized public result links", () => {
  const enUrl = "https://quizdip.vercel.app/en/results/123e4567-e89b-12d3-a456-426614174000";
  assert.equal(publicResultSharePayload("facebook", enUrl, "Title", "Text").url, enUrl);
});
