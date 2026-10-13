/** A sequence can reuse one approved image for blurred, clearer and plain-image clues. */
export type ImageClueStage = { type: string; mediaId?: string };

function isImageStage(clue: ImageClueStage | undefined): boolean {
  return !!clue?.mediaId && (clue.type === "image" || clue.type === "image-reveal");
}

/**
 * Return the media stage to display at this clue's ORIGINAL position.
 * Once another stage of the same image is revealed, update the first image
 * in place instead of rendering an additional image below it. Text belongs
 * to the original clue and should always remain visible.
 *
 * Only pass revealed clues. Never reveal future media or their settings.
 */
export function activeImageStage<T extends ImageClueStage>(clues: readonly T[], index: number): T | null {
  const clue = clues[index];
  if (!clue) return null;
  if (!isImageStage(clue)) return clue;
  if (clues.slice(0, index).some(previous =>
    isImageStage(previous) && previous.mediaId === clue.mediaId)) return null;
  for (let i = clues.length - 1; i >= index; i--) {
    const stage = clues[i];
    if (isImageStage(stage) && stage.mediaId === clue.mediaId) return stage;
  }
  return clue;
}
