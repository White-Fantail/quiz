import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMediaBytes, mediaUploadLabel, mediaModerationNames } from "../src/lib/media-view.ts";

test("file sizes are legible at B, KB, MB and GB ranges (never 0.00MB)", () => {
  assert.equal(formatMediaBytes(699), "699 B");
  assert.equal(formatMediaBytes(0), "0 B");
  assert.equal(formatMediaBytes(25644), "25 KB");
  assert.equal(formatMediaBytes(1536), "1.5 KB");
  assert.equal(formatMediaBytes(1024**2), "1.0 MB");
  assert.equal(formatMediaBytes(1024**3), "1.0 GB");
  assert.equal(formatMediaBytes(-1), "—");
});

test("upload lifecycle and moderation labels are distinct", () => {
  const now=Date.parse("2026-10-11T10:00:00Z");
  assert.equal(mediaUploadLabel("READY",null,now), "업로드 완료");
  assert.equal(mediaUploadLabel("UPLOADING","2026-10-11T09:00:00Z",now),"업로드 만료");
  assert.equal(mediaUploadLabel("UPLOADING","2026-10-11T11:00:00Z",now),"업로드 중");
  assert.equal(mediaModerationNames.PENDING,"안전 검토 대기");
  assert.equal(mediaModerationNames.APPROVED,"안전 검토 승인");
  assert.equal(mediaModerationNames.RESTRICTED,"사용 제한");
});
