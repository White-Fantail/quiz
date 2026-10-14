import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("only completed pack results offer a result-image share card", () => {
  const player = read("app/(platform)/play/page.tsx");
  assert.match(player, /import PackResultShare from/);
  assert.match(player, /run\.mode==="PACK"&&packId&&run\.status==="FINISHED"&&<PackResultShare/);
  assert.match(player, /score=\{run\.score\}/);
  assert.match(player, /completed=\{run\.completed\}/);
  assert.match(player, /solved=\{run\.solved\|\|0\}/);
  assert.match(player, /title=\{pack\?\.title/);
  assert.match(player, /<PackFeedback packId=\{packId\}/);
});

test("result image contains the pack title and scored outcome, not answer keys or run credentials", () => {
  const component = read("src/components/pack-result-share.tsx");
  for (const key of ["data.title", "data.score", "data.completed", "data.solved",
    "renderPng", "canvas.toBlob", '"image/png"', "createObjectURL", 'localizeHref("/packs/" + packId, locale)']) {
    assert.ok(component.includes(key), "Missing card requirement: " + key);
  }
  assert.doesNotMatch(component, /runToken|sessionToken|answerKey|leaderboardRank|qr-code|QRCode/i);
});

test("Web Share includes quiz pack URL with portable image, plus explicit save and copy fallbacks", () => {
  const component = read("src/components/pack-result-share.tsx");
  assert.match(component, /navigator\.canShare\?\.\(\{ files: \[asset\.file\] \}\)/);
  assert.match(component, /navigator\.share\(\{ title: title \+ " · QuizDip", text: shareText, url: packUrl, files: \[asset\.file\] \}\)/);
  assert.match(component, /navigator\.clipboard\.writeText\(packUrl\)/);
  assert.match(component, /anchor\.download = asset\.file\.name/);
  assert.match(component, /error\.name === "AbortError"/);
  assert.match(component, /"ko"/);
  assert.match(component, /"en-US"/);
});

test("result preview remains legible at mobile sizes", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.pack-result-share-preview/);
  assert.match(css, /aspect-ratio:4\/5/);
  assert.match(css, /\.pack-result-share-actions/);
  assert.match(css, /@media \(max-width:640px\)/);
});
