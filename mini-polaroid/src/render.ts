import type { Layout } from "./layout";
import type { Photo, SheetOptions } from "./types";
import { drawCutLines, drawPolaroid, drawRulerTicks } from "./polaroid";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** 페이지 좌표계로 시트 전체 그리기. scale 로 미리보기/최종 공용 */
export function drawSheet(ctx: Ctx, L: Layout, slots: (Photo | null)[], opt: SheetOptions, scale = 1) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";                 // 종이
  ctx.fillRect(0, 0, L.pageW, L.pageH);
  L.cells.forEach((c, i) => drawPolaroid(ctx, L, c.x, c.y, slots[i] ?? null, opt));
  if (opt.showCutLines) drawCutLines(ctx, L);
  if (opt.rulerTicks) drawRulerTicks(ctx, L);
  ctx.restore();
}

/** 미리보기: 화면 크기에 맞춘 저해상 캔버스 */
export function renderPreview(canvas: HTMLCanvasElement, L: Layout, slots: (Photo | null)[], opt: SheetOptions, cssWidth: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (cssWidth * dpr) / L.pageW;
  canvas.width = Math.round(L.pageW * scale);
  canvas.height = Math.round(L.pageH * scale);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${(cssWidth * L.pageH) / L.pageW}px`;
  drawSheet(canvas.getContext("2d")!, L, slots, opt, scale);
}

/** 최종 JPEG (1200×1800 @300dpi 또는 2400×3600 @600dpi) */
export async function renderFinalJpeg(L: Layout, slots: (Photo | null)[], opt: SheetOptions, quality = 0.92): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined") {
    const oc = new OffscreenCanvas(L.pageW, L.pageH);
    drawSheet(oc.getContext("2d")!, L, slots, opt, 1);
    return oc.convertToBlob({ type: "image/jpeg", quality });
  }
  const c = document.createElement("canvas");
  c.width = L.pageW; c.height = L.pageH;
  drawSheet(c.getContext("2d")!, L, slots, opt, 1);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob 실패"))), "image/jpeg", quality));
}
