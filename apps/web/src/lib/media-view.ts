/** Display helpers shared by the Studio media library and source-level tests. */
export function formatMediaBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1024) return value + " B";
  if (value < 1024 ** 2) return (value / 1024).toFixed(value < 10 * 1024 ? 1 : 0) + " KB";
  if (value < 1024 ** 3) return (value / (1024 ** 2)).toFixed(1) + " MB";
  return (value / (1024 ** 3)).toFixed(1) + " GB";
}
export function mediaUploadLabel(status: string, expiry?: string | null, now=Date.now()): string {
  if (status === "READY") return "업로드 완료";
  if (status === "UPLOADING" && expiry && new Date(expiry).getTime() <= now) return "업로드 만료";
  if (status === "UPLOADING") return "업로드 중";
  return "업로드 " + status;
}
export const mediaModerationNames: Record<string,string> = {
  PENDING: "안전 검토 대기",
  APPROVED: "안전 검토 승인",
  RESTRICTED: "사용 제한",
};
