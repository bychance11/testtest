import { mmToPx, TICK_MM, type Layout } from "./layout";
import type { Photo, SheetOptions } from "./types";

/** 사진의 정사각 크롭 소스 영역 계산 (cover + 사용자 조정) */
export function cropRect(p: Photo) {
  const s = Math.min(p.width, p.height) / Math.max(1, p.crop.zoom);
  const sx = Math.min(Math.max(p.crop.cx * p.width - s / 2, 0), p.width - s);
  const sy = Math.min(Math.max(p.crop.cy * p.height - s / 2, 0), p.height - s);
  return { sx, sy, s };
}

/** 폴라로이드 한 칸 그리기. 좌표는 페이지(px) 기준, ctx 에 scale 이 걸려 있어도 됨 */
export function drawPolaroid(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  L: Layout, x: number, y: number, photo: Photo | null, opt: SheetOptions,
) {
  // 1) 프레임 — 인쇄물이므로 그림자/둥근 모서리 없음
  ctx.fillStyle = opt.frameColor;
  ctx.fillRect(x, y, L.cellW, L.cellH);

  const ix = x + L.border, iy = y + L.border;

  // 2) 사진 (정사각 cover)
  if (photo) {
    const { sx, sy, s } = cropRect(photo);
    ctx.drawImage(photo.print, sx, sy, s, s, ix, iy, L.img, L.img);
  } else {
    ctx.fillStyle = "#f1efe9";             // 빈 칸은 연한 회색 사각
    ctx.fillRect(ix, iy, L.img, L.img);
  }

  // 3) 사진 둘레 얇은 선 — 흰 프레임과 밝은 사진 경계 구분
  if (opt.photoEdge) {
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = Math.max(1, L.dpi / 300);
    ctx.strokeRect(ix + 0.5, iy + 0.5, L.img - 1, L.img - 1);
  }
}

/** 재단선: 칸 경계에 점선 (칸 사이 간격이 0이므로 공유 변 위에 그림) */
export function drawCutLines(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, L: Layout) {
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = Math.max(1, L.dpi / 300);
  ctx.setLineDash([L.dpi / 50, L.dpi / 50]);
  const x0 = L.cells[0].x, y0 = L.cells[0].y;
  const gw = L.cols * L.cellW, gh = L.rows * L.cellH;
  for (let c = 0; c <= L.cols; c++) {
    const x = x0 + c * L.cellW + 0.5;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + gh); ctx.stroke();
  }
  for (let r = 0; r <= L.rows; r++) {
    const y = y0 + r * L.cellH + 0.5;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + gw, y); ctx.stroke();
  }
  ctx.restore();
}

/**
 * 자 맞춤선: 종이 가장자리 네 변에서 안쪽으로 TICK_MM(0.5cm) 만큼만 그리는 얇은 검은 선.
 * 모든 칸 경계(세로 cols+1 개, 가로 rows+1 개) 위치에 찍히므로, 위·아래(또는 좌·우) 선을 자로 이으면 재단선이 된다.
 * 선은 바깥 여백 안에만 있고 폴라로이드/사진 영역으로는 절대 들어가지 않는다.
 */
export function drawRulerTicks(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, L: Layout) {
  const x0 = L.cells[0].x, y0 = L.cells[0].y;
  const gw = L.cols * L.cellW, gh = L.rows * L.cellH;
  const tick = mmToPx(TICK_MM, L.dpi);
  // 여백이 선 길이보다 좁으면(반올림 오차 등) 격자 직전까지만
  const vLen = Math.min(tick, y0, L.pageH - (y0 + gh));
  const hLen = Math.min(tick, x0, L.pageW - (x0 + gw));

  ctx.save();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(1, Math.round(L.dpi / 300));   // 300dpi 1px, 600dpi 2px
  ctx.setLineDash([]);
  const half = ctx.lineWidth / 2;

  for (let c = 0; c <= L.cols; c++) {                       // 세로 경계 → 위/아래 변에 세로 선
    const x = Math.round(x0 + c * L.cellW) + (c === L.cols ? -half : half);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, vLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, L.pageH); ctx.lineTo(x, L.pageH - vLen); ctx.stroke();
  }
  for (let r = 0; r <= L.rows; r++) {                       // 가로 경계 → 좌/우 변에 가로 선
    const y = Math.round(y0 + r * L.cellH) + (r === L.rows ? -half : half);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(hLen, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L.pageW, y); ctx.lineTo(L.pageW - hLen, y); ctx.stroke();
  }
  ctx.restore();
}
