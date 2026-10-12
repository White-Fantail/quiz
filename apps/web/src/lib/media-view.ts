/** Display helpers shared by the Studio media library and source-level tests. */
export function formatMediaBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1024) return value + " B";
  if (value < 1024 ** 2) return (value / 1024).toFixed(value < 10 * 1024 ? 1 : 0) + " KB";
  if (value < 1024 ** 3) return (value / (1024 ** 2)).toFixed(1) + " MB";
  return (value / (1024 ** 3)).toFixed(1) + " GB";
}
export function mediaUploadLabel(status: string, expiry?: string | null, now=Date.now(), locale:"en"|"ko"="ko"): string {
  const label=(en:string,ko:string)=>locale==="ko"?ko:en;
  if (status === "READY") return label("Upload complete","업로드 완료");
  if (status === "UPLOADING" && expiry && new Date(expiry).getTime() <= now) return label("Upload expired","업로드 만료");
  if (status === "UPLOADING") return label("Uploading","업로드 중");
  return label("Upload ","업로드 ") + status;
}
export const mediaModerationNames: Record<string,string> = {
  PENDING: "안전 검토 대기",
  APPROVED: "안전 검토 승인",
  RESTRICTED: "사용 제한",
};
export function mediaModerationLabel(status:string,locale:"en"|"ko"="ko"):string {
  const english:Record<string,string>={PENDING:"Awaiting safety review",APPROVED:"Safety approved",RESTRICTED:"Restricted"};
  return locale==="ko"?(mediaModerationNames[status]||status):(english[status]||status);
}
