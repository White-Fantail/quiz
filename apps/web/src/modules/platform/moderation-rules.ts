/** Pure, no-AI and configurable report-hold decision. Reports are signals only. */
export type ReportHoldPolicy = {
  enabled: boolean;
  quizReportThreshold: number;
  packReportThreshold: number;
  windowHours: number;
  minimumEstablishedReporters: number;
  establishedAccountDays: number;
};
export const DEFAULT_REPORT_HOLD_POLICY: ReportHoldPolicy = {
  enabled: true, quizReportThreshold: 3, packReportThreshold: 3,
  windowHours: 24, minimumEstablishedReporters: 2, establishedAccountDays: 7
};
export function shouldAutoHold(
  policy: ReportHoldPolicy, kind: "QUIZ" | "PACK",
  distinctReporters: number, establishedReporters: number
): boolean {
  if (!policy.enabled) return false;
  const threshold = kind === "QUIZ" ? policy.quizReportThreshold : policy.packReportThreshold;
  return distinctReporters >= threshold && establishedReporters >= policy.minimumEstablishedReporters;
}
