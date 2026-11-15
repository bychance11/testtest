import type { Photo } from "./types";

const PRINT_MAX = 900;   // 인쇄용 축소 긴 변 (600dpi 16장 셀 사진 ~520px 이상이면 충분)
const THUMB_MAX = 240;

function isHeic(file: File) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

async function toDecodableBlob(file: File): Promise<Blob> {
  // iOS Safari 는 선택 시 HEIC→JPEG 자동 변환. Android 등에서 HEIC 원본이 오면 지연 로드 변환
  if (!isHeic(file)) return file;
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(out) ? out[0] : out;
}

/** <img> 로 디코드하면 모바일 브라우저가 EXIF 회전을 자동 적용함 (가장 호환성 높음) */
function decodeImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이미지를 읽을 수 없습니다")); };
    img.src = url;
  });
}

function scaled(img: HTMLImageElement, max: number): HTMLCanvasElement {
  const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * r));
  c.height = Math.max(1, Math.round(img.naturalHeight * r));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function canvasToBlob(c: HTMLCanvasElement, type: string, q: number): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob 실패"))), type, q));
}

export async function loadPhoto(file: File): Promise<Photo> {
  const blob = await toDecodableBlob(file);
  const img = await decodeImage(blob);          // 원본은 한 장씩만 메모리에 올림

  const printCanvas = scaled(img, PRINT_MAX);
  const thumbCanvas = scaled(img, THUMB_MAX);
  img.src = "";                                 // 원본 디코드 메모리 해제 유도

  const print = await createImageBitmap(printCanvas);
  const thumbUrl = URL.createObjectURL(await canvasToBlob(thumbCanvas, "image/jpeg", 0.8));

  return {
    id: crypto.randomUUID(),
    name: file.name,
    thumbUrl,
    print,
    width: print.width,
    height: print.height,
    crop: { cx: 0.5, cy: 0.5, zoom: 1 },
  };
}

/** 여러 장을 순차 처리 (동시 디코드하면 저가폰에서 메모리 초과) */
export async function loadPhotos(files: File[], onProgress?: (done: number, total: number) => void) {
  const out: Photo[] = [];
  for (let i = 0; i < files.length; i++) {
    try { out.push(await loadPhoto(files[i])); }
    catch (e) { console.warn("skip", files[i].name, e); }
    onProgress?.(i + 1, files.length);
  }
  return out;
}
