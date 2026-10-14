"use client";

import { useEffect, useState } from "react";
import { useLocale } from "../i18n/provider";
import { localizeHref } from "../i18n/core";

type PackResultShareProps = {
  packId: string;
  title: string;
  score: number;
  completed: number;
  solved: number;
};

type ImageAsset = { file: File; previewUrl: string };

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function fitLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const char of Array.from(text.trim().replace(/\s+/g, " "))) {
    if (current && ctx.measureText(current + char).width > maxWidth) {
      lines.push(current.trimEnd());
      current = char.trimStart();
      if (lines.length === maxLines) break;
    } else {
      current += char;
    }
  }
  if (lines.length < maxLines && current) lines.push(current.trimEnd());
  if (lines.length === maxLines) {
    const original = lines.join("") + current;
    if (original.length < text.trim().replace(/\s+/g, " ").length) {
      let last = lines[maxLines - 1];
      while (last && ctx.measureText(last + "…").width > maxWidth) last = Array.from(last).slice(0, -1).join("");
      lines[maxLines - 1] = last.trimEnd() + "…";
    }
  }
  return lines;
}

function paintResultCard(canvas: HTMLCanvasElement, data: PackResultShareProps, url: string, korean: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;

  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, "#5247d7");
  bg.addColorStop(0.52, "#7363ec");
  bg.addColorStop(1, "#322682");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(1010, 90, 300, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.10;
  ctx.beginPath(); ctx.arc(10, 1170, 350, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#ffffff";
  ctx.font = '800 54px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillText("quizdip", 84, 119);
  ctx.fillStyle = "#FFD36E";
  ctx.beginPath(); ctx.arc(287, 107, 11, 0, Math.PI * 2); ctx.fill();

  ctx.font = '700 27px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillStyle = "#dad5ff";
  ctx.fillText(korean ? "나의 퀴즈팩 기록" : "MY QUIZ PACK RESULT", 86, 228);

  ctx.font = '800 64px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillStyle = "#ffffff";
  const titleLines = fitLines(ctx, data.title, 905, 4);
  titleLines.forEach((line, i) => ctx.fillText(line, 84, 318 + i * 85));

  const panelY = 680;
  roundedRect(ctx, 66, panelY, 948, 385, 44);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = "#272341";
  ctx.font = '700 27px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillText(korean ? "나의 도전 결과" : "HOW I DID", 111, panelY + 67);

  ctx.fillStyle = "#6255E8";
  ctx.font = '900 110px system-ui, "Apple SD Gothic Neo", sans-serif';
  const scoreText = new Intl.NumberFormat(korean ? "ko-KR" : "en-US").format(data.score);
  ctx.fillText(scoreText, 111, panelY + 206);
  const scoreWidth = ctx.measureText(scoreText).width;
  ctx.fillStyle = "#696B82";
  ctx.font = '700 27px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillText(korean ? "점" : "PTS", 131 + scoreWidth, panelY + 203);

  ctx.fillStyle = "#e8e6f2";
  ctx.fillRect(110, panelY + 251, 860, 2);

  ctx.font = '800 43px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillStyle = "#252642";
  ctx.fillText(String(data.solved) + " / " + String(data.completed), 111, panelY + 317);
  ctx.fillText(String(data.completed), 585, panelY + 317);
  ctx.font = '600 23px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillStyle = "#696B82";
  ctx.fillText(korean ? "맞힌 문제" : "CORRECT", 111, panelY + 350);
  ctx.fillText(korean ? "완료한 문제" : "COMPLETED", 585, panelY + 350);

  ctx.fillStyle = "#ffffff";
  ctx.font = '800 32px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillText(korean ? "당신도 이 퀴즈팩에 도전해 보세요!" : "Think you can beat my result?", 86, 1155);
  ctx.font = '600 25px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillStyle = "#e7e3ff";
  const urlLines = fitLines(ctx, url, 898, 2);
  urlLines.forEach((line, i) => ctx.fillText(line, 86, 1211 + i * 36));
}

function renderPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG generation failed")), "image/png");
  });
}

/**
 * This is a presentation-only export of the server-returned finished run.
 * The shared link always points to the public pack, never to a private run token.
 */
export default function PackResultShare({ packId, title, score, completed, solved }: PackResultShareProps) {
  const locale = useLocale();
  const korean = locale === "ko";
  const [packUrl, setPackUrl] = useState("");
  const [asset, setAsset] = useState<ImageAsset | null>(null);
  const [notice, setNotice] = useState("");
  const [renderError, setRenderError] = useState("");

  useEffect(() => {
    setPackUrl(new URL(localizeHref("/packs/" + packId, locale), window.location.origin).href);
  }, [packId, locale]);

  useEffect(() => {
    if (!packUrl) return;
    let active = true;
    let previewUrl: string | undefined;
    setAsset(null);
    setRenderError("");
    void (async () => {
      try {
        await document.fonts?.ready;
        if (!active) return;
        const canvas = document.createElement("canvas");
        paintResultCard(canvas, { packId, title, score, completed, solved }, packUrl, korean);
        const blob = await renderPng(canvas);
        if (!active) return;
        previewUrl = URL.createObjectURL(blob);
        setAsset({ file: new File([blob], "quizdip-pack-result.png", { type: "image/png" }), previewUrl });
      } catch {
        if (active) setRenderError(korean ? "결과 이미지를 만들지 못했어요. 링크는 공유할 수 있어요." : "Couldn't create the image. You can still share the link.");
      }
    })();
    return () => { active = false; if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [packId, title, score, completed, solved, packUrl, korean]);

  const shareText = korean
    ? `퀴즈딥에서 「${title}」 도전 완료! ${score}점 · ${solved}/${completed} 정답. 당신도 도전해 보세요!\n${packUrl}`
    : `I finished "${title}" on QuizDip! ${score} points · ${solved}/${completed} correct. Try it yourself!\n${packUrl}`;

  async function copyLink() {
    if (!packUrl) return;
    try {
      await navigator.clipboard.writeText(packUrl);
      setNotice(korean ? "퀴즈팩 링크를 복사했어요." : "Pack link copied.");
    } catch {
      setNotice(packUrl);
    }
  }

  function downloadImage() {
    if (!asset) return;
    const anchor = document.createElement("a");
    anchor.href = asset.previewUrl;
    anchor.download = asset.file.name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setNotice(korean ? "이미지를 저장했어요. 링크도 함께 공유해 주세요." : "Image saved. Include the pack link when posting.");
  }

  async function shareResult() {
    if (!packUrl) return;
    setNotice("");
    try {
      if (asset && navigator.share && navigator.canShare?.({ files: [asset.file] })) {
        // Some destination apps ignore text/URL when receiving an image; keep the copy-link button visible.
        await navigator.share({ title: title + " · QuizDip", text: shareText, url: packUrl, files: [asset.file] });
        setNotice(korean ? "공유가 완료됐는지 앱에서 확인해 주세요. 링크는 별도로 복사할 수도 있어요." : "Check the destination for the link. You can also copy it separately.");
      } else if (navigator.share) {
        await navigator.share({ title: title + " · QuizDip", text: shareText, url: packUrl });
        setNotice(korean ? "링크를 공유했어요. 이미지는 별도로 저장할 수 있어요." : "Link shared. The image can be saved separately.");
      } else {
        if (asset) downloadImage();
        try {
          await navigator.clipboard.writeText(shareText);
          setNotice(korean ? "이미지를 저장하고 공유 문구와 링크를 복사했어요." : "Image saved and share caption with link copied.");
        } catch {
          setNotice(shareText);
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(korean ? "공유할 수 없어요. 이미지 저장과 링크 복사를 이용해 주세요." : "Sharing failed. Save the image and copy the link instead.");
    }
  }

  return <section className="pack-result-share" aria-label={korean ? "결과 이미지 공유" : "Share result image"}>
    <div className="pack-result-share-heading">
      <h3>{korean ? "내 기록을 공유해 보세요" : "Share your result"}</h3>
      <p>{korean ? "퀴즈팩 제목과 내 점수를 한 장의 카드로!" : "Your quiz pack and your results, in one image."}</p>
    </div>
    {asset ? <img className="pack-result-share-preview" src={asset.previewUrl}
      alt={korean ? `${title} · ${score}점 · ${completed}문제 중 ${solved}문제 정답` : `${title} · ${score} points · ${solved} out of ${completed} correct`} /> :
      <div className="pack-result-share-placeholder" role="status">{renderError || (korean ? "결과 카드 만드는 중…" : "Preparing your result card…")}</div>}
    <div className="pack-result-share-actions">
      <button type="button" className="btn btn-primary" onClick={() => void shareResult()} disabled={!packUrl}>
        {korean ? "결과 공유하기 ↗" : "Share result ↗"}
      </button>
      <button type="button" className="btn btn-outline" onClick={downloadImage} disabled={!asset}>
        {korean ? "이미지 저장" : "Save image"}
      </button>
      <button type="button" className="btn btn-outline" onClick={() => void copyLink()} disabled={!packUrl}>
        {korean ? "팩 링크 복사" : "Copy pack link"}
      </button>
    </div>
    <p className="pack-result-share-note">{korean
      ? "공유 앱에 따라 사진과 링크가 함께 전달되지 않을 수 있어요. 그럴 땐 링크 복사를 이용해 주세요."
      : "Some apps don't attach a link to shared photos. Use Copy pack link when needed."}</p>
    {notice && <p role="status" className="pack-result-share-notice">{notice}</p>}
  </section>;
}
