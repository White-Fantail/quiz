"use client";

import { ImageReveal, type RevealSettings } from "./image-reveal";
import { useLocale } from "../i18n/provider";
import { bilingual } from "../i18n/view-copy";

export type ReviewClue = {
  id?: string;
  type: "text" | "image" | "image-reveal" | "audio" | "video" | "map";
  text?: string;
  mediaId?: string;
  reveal?: RevealSettings;
  map?: { latitude: number; longitude: number; zoom?: number };
};

type ReviewMedia = { kind: string; url: string };

/** Preserve each original clue stage, including successive reveals of one image. */
export function RemainingClues({ clues, firstClueIndex, media }: {
  clues: ReviewClue[]; firstClueIndex: number; media: Record<string, ReviewMedia>;
}) {
  const locale = useLocale();
  const msg = (en: string, ko: string) => bilingual(locale, en, ko);
  return <ol className="clue-list remaining-clue-list" start={firstClueIndex}
    style={{ counterReset: `clue ${firstClueIndex - 1}` }}>
    {clues.map((clue, index) => {
      const asset = clue.mediaId ? media[clue.mediaId] : undefined;
      return <li key={clue.id ?? index}>
        {clue.text && <p>{clue.text}</p>}
        {clue.mediaId && (asset ? (
          asset.kind === "image" ? (clue.type === "image-reveal" && clue.reveal ?
            <ImageReveal src={asset.url} alt={msg("Review clue image", "복습 단서 이미지")} reveal={clue.reveal} /> :
            <img className="round-media" src={asset.url} alt={msg("Review clue image", "복습 단서 이미지")} />) :
          asset.kind === "audio" ? <audio controls className="round-audio" src={asset.url} preload="none" /> :
          asset.kind === "video" ? <video controls className="round-media" src={asset.url} preload="metadata" /> :
          <p className="muted">{msg("Media is unavailable.", "미디어를 볼 수 없어요.")}</p>
        ) : <p className="muted">{msg("Media is unavailable.", "미디어를 볼 수 없어요.")}</p>)}
        {clue.type === "map" && clue.map && <div className="map-clue">
          <a href={`https://www.openstreetmap.org/?mlat=${clue.map.latitude}&mlon=${clue.map.longitude}#map=${clue.map.zoom ?? 8}/${clue.map.latitude}/${clue.map.longitude}`}
            target="_blank" rel="noopener noreferrer">{msg("View map clue ↗", "지도 단서 보기 ↗")}</a>
        </div>}
      </li>;
    })}
  </ol>;
}
