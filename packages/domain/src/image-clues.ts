/** A sequence can reuse one approved image for progressive and plain-image clues. */
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


/**
 * Spotlight strength is inverse visibility: 100 reveals only a small detail,
 * and 0 is the final, completely visible image (renderers remove the mask).
 * The easing makes high-strength early clues genuinely small rather than
 * exposing most of the object at the first stage.
 *
 * CSS circle(%) defines its radius using the box's normalized diagonal:
 * hypot(width, height) / sqrt(2). Native SVG must use the same geometry.
 */
export function spotlightRevealRadiusPercent(strength: number): number {
  const obscurity = Number.isFinite(strength)
    ? Math.max(0, Math.min(100, strength))
    : 100;
  return Math.max(2, 100 * Math.pow(1 - obscurity / 100, 1.5));
}

export function spotlightRevealRadiusPixels(strength: number, width: number, height: number): number {
  const w = Number.isFinite(width) ? Math.max(0, width) : 0;
  const h = Number.isFinite(height) ? Math.max(0, height) : 0;
  return spotlightRevealRadiusPercent(strength) / 100 * Math.hypot(w, h) / Math.SQRT2;
}
