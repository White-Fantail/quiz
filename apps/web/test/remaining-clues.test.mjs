import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { operations, parseOperation } from "../src/modules/platform/contracts.ts";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sessionId = "94f0792a-18e6-40c0-a480-0be6d46dbb37";
const sessionToken = "a".repeat(44);

test("remaining-clue review is a token-scoped REST + MCP operation", () => {
  assert.equal(operations.play_review.public, true);
  assert.equal(parseOperation("play_review", { sessionId, sessionToken }).sessionId, sessionId);
  assert.throws(() => parseOperation("play_review", { sessionId }));
  assert.match(read("app/api/v1/[...segments]/route.ts"), /c === "review" && method === "POST".*play_review/);
  assert.match(read("src/modules/platform/operations.ts"), /case "play_review": return playReview\(p, actor\)/);
  assert.match(read("app/api/mcp/route.ts"), /"quizdip_" \+ name/);
});

test("review is read-only and never unlocks an active round", () => {
  const service = read("src/modules/platform/play.ts");
  const review = service.slice(service.indexOf("export async function playReview"),
    service.indexOf("export async function playClue"));
  assert.match(review, /allowCompletedRun: true/);
  assert.match(review, /session\.status !== "SOLVED" && session\.status !== "FAILED"/);
  assert.match(review, /clues\.slice\(session\.usedClues\)/);
  assert.doesNotMatch(review, /playSession\.update|\$transaction|scoreForAnswer/);
  assert.match(service, /allowCompletedRun && completed/);
  const media = read("src/modules/platform/media.ts");
  assert.match(media, /finished \? allClues : allClues\.slice\(0, session\.usedClues\)/);
  assert.match(media, /media\.moderationStatus !== "APPROVED"/);
});

test("solo and pack players can expand original multimedia stages after scoring", () => {
  for (const path of ["app/(platform)/play/page.tsx", "app/(platform)/play/[quizId]/page.tsx"]) {
    const source = read(path);
    assert.match(source, /RemainingClues/);
    assert.match(source, /\/review"/);
    assert.match(source, /remainingCount > 0/);
    assert.match(source, /aria-expanded=\{reviewOpen\}/);
    assert.match(source, /reviewBusy/);
    assert.match(source, /\/media"/);
  }
  const component = read("src/components/remaining-clues.tsx");
  for (const element of ["ImageReveal", "<audio", "<video", 'type === "map"', "counterReset"]) {
    assert.ok(component.includes(element), "Missing review rendering: " + element);
  }
});
