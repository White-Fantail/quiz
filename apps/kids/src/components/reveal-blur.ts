/**
 * QuizDip stores one device-independent reveal strength (0 = clear, 100 = obscured).
 * CSS blur and native-image blur use different renderers and are not pixel-equivalent.
 * iOS needs a stronger native radius than the web; Android gets its own calibration.
 *
 * Keep this entirely client-side: changing the display must not mutate a published
 * quiz revision, invalidate Kids moderation, or require another copy of the media.
 */
export function nativeRevealBlurRadius(strength: number, platform: string): number {
  // Unknown input must not accidentally reveal a concealed answer.
  const value = Number.isFinite(strength) ? Math.max(0, Math.min(100, strength)) : 100;
  if (value === 0) return 0;
  const factor = platform === "ios" ? 1.45 : platform === "android" ? 1.0 : 0.3;
  const maxRadius = platform === "ios" ? 72 : platform === "android" ? 60 : 30;
  return Math.min(maxRadius, Math.round(value * factor * 10) / 10);
}
