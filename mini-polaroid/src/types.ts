export interface Crop {
  cx: number;   // 정사각 크롭 중심 x (0~1)
  cy: number;   // 정사각 크롭 중심 y (0~1)
  zoom: number; // 1 = 짧은 변에 맞춤, 클수록 확대
}

export interface Photo {
  id: string;
  name: string;
  thumbUrl: string;         // 썸네일 Blob URL (UI 표시용)
  print: ImageBitmap;       // 인쇄용 축소 비트맵 (긴 변 ~900px)
  width: number;            // print 기준 크기
  height: number;
  crop: Crop;
}

export type Orientation = "portrait" | "landscape";
export type EmptyMode = "blank" | "repeat" | "duplicate-first";
export type Dpi = 300 | 600;

export interface SheetOptions {
  presetId: string;
  orientation: Orientation;
  dpi: Dpi;
  emptyMode: EmptyMode;
  showCutLines: boolean;    // 칸 경계를 가로지르는 점선 (사진 영역 위로 지나감)
  rulerTicks: boolean;      // 바깥 여백에만 그리는 자 맞춤선 (사진 영역엔 선 없음)
  frameColor: string;
  photoEdge: boolean;       // 사진 둘레 얇은 회색선
}
