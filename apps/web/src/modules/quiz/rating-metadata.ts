/** Public vote aggregates. Small samples should not display a misleading percentage. */
export type RatingSummary = { positive: number; negative: number; total: number; positivePercent: number|null };
export const MIN_PUBLIC_RATINGS = 5;
export function ratingSummary(positive:number,negative:number):RatingSummary {
  const total=positive+negative;
  return {positive,negative,total,positivePercent:total>=MIN_PUBLIC_RATINGS?Math.round(100*positive/total):null};
}
