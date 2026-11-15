import type { Orientation, Dpi } from "./types";

export interface Preset { id: string; label: string; cols: number; rows: number }

// cols × rows 는 세로(4x6) 기준. 가로 모드에서는 자동으로 뒤바꿈
export const PRESETS: Preset[] = [
  { id: "6",  label: "6장",  cols: 2, rows: 3 },
  { id: "9",  label: "9장",  cols: 3, rows: 3 },
  { id: "12", label: "12장", cols: 3, rows: 4 },
  { id: "16", label: "16장", cols: 4, rows: 4 },
  { id: "20", label: "20장", cols: 4, rows: 5 },
  { id: "24", label: "24장", cols: 4, rows: 6 },
  { id: "30", label: "30장", cols: 5, rows: 6 },
];

export const PAGE_IN = { short: 4, long: 6 };  // 4x6 inch
export const MARGIN_MM = 3;      // 인쇄 한 장 바깥쪽 안전여백 (키오스크 재단 대비)
export const GUTTER_MM = 0;      // 폴라로이드 사이 간격 없음 — 각 칸의 흰 테두리가 곧 재단 여유
export const CELL_RATIO = 1.2;   // 폴라로이드 세로/가로 (실물 88×107mm ≈ 1.216)
export const SIDE_FRAC = 0.05;   // 좌/우/상 테두리 = 셀 가로의 5%  → 하단 여백 = 25%

export const mmToPx = (mm: number, dpi: number) => (mm / 25.4) * dpi;
export const pxToMm = (px: number, dpi: number) => (px / dpi) * 25.4;

export interface Layout {
  dpi: Dpi;
  pageW: number; pageH: number;
  cols: number; rows: number;
  cellW: number; cellH: number;
  border: number;   // 좌/우/상 테두리 px
  img: number;      // 정사각 사진 한 변 px
  cells: { x: number; y: number }[];
}

export function getPreset(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[3];
}

export function computeLayout(preset: Preset, orientation: Orientation, dpi: Dpi): Layout {
  const portrait = orientation === "portrait";
  const pageW = (portrait ? PAGE_IN.short : PAGE_IN.long) * dpi;
  const pageH = (portrait ? PAGE_IN.long : PAGE_IN.short) * dpi;
  const cols = portrait ? preset.cols : preset.rows;
  const rows = portrait ? preset.rows : preset.cols;

  const margin = mmToPx(MARGIN_MM, dpi);
  const gutter = mmToPx(GUTTER_MM, dpi);
  const aw = pageW - 2 * margin - (cols - 1) * gutter;
  const ah = pageH - 2 * margin - (rows - 1) * gutter;

  const cellW = Math.floor(Math.min(aw / cols, ah / rows / CELL_RATIO));
  const cellH = Math.floor(cellW * CELL_RATIO);
  const gridW = cols * cellW + (cols - 1) * gutter;
  const gridH = rows * cellH + (rows - 1) * gutter;
  const x0 = Math.round((pageW - gridW) / 2);   // 격자는 항상 중앙 정렬
  const y0 = Math.round((pageH - gridH) / 2);

  const border = Math.round(cellW * SIDE_FRAC);
  const img = cellW - 2 * border;

  const cells = Array.from({ length: cols * rows }, (_, i) => ({
    x: x0 + (i % cols) * (cellW + gutter),
    y: y0 + Math.floor(i / cols) * (cellH + gutter),
  }));

  return { dpi, pageW, pageH, cols, rows, cellW, cellH, border, img, cells };
}
