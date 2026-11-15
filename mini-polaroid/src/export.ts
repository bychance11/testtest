/** 저장 경로 우선순위: 공유시트(사진앱 저장) → 다운로드 → 이미지 길게 누르기 안내 */
export type ExportResult = "shared" | "downloaded" | "fallback";

export async function saveOrShare(blob: Blob, filename: string): Promise<ExportResult> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "미니폴라로이드 인쇄" });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "shared";  // 사용자가 취소
    }
  }
  const standalone = matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!standalone) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    return "downloaded";
  }
  return "fallback";
}

/** 집 프린터(AirPrint 등): 4x6 용지로 바로 인쇄 */
export function printBlob(blob: Blob, landscape: boolean) {
  const url = URL.createObjectURL(blob);
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>인쇄</title>
<style>@page{size:${landscape ? "6in 4in" : "4in 6in"};margin:0}html,body{margin:0}img{display:block;width:100%;height:100%;object-fit:contain}</style>
</head><body><img src="${url}" onload="setTimeout(()=>{print()},200)"></body></html>`);
  w.document.close();
  return true;
}

export function filename(presetId: string, dpi: number) {
  const d = new Date();
  const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  return `minipolaroid-${presetId}cut-${dpi}dpi-${ts}.jpg`;
}
