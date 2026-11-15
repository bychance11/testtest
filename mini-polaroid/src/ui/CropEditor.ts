import type { Photo } from "../types";
import { cropRect } from "../polaroid";
import { updateCrop } from "../state";

/** 정사각 뷰포트 안에서 사진을 드래그/확대해 크롭 위치를 정함 */
export function setupCropEditor() {
  const dlg = document.getElementById("cropDialog") as HTMLDialogElement;
  const canvas = document.getElementById("cropCanvas") as HTMLCanvasElement;
  const zoom = document.getElementById("cropZoom") as HTMLInputElement;
  const reset = document.getElementById("cropReset") as HTMLButtonElement;
  const done = document.getElementById("cropDone") as HTMLButtonElement;
  const ctx = canvas.getContext("2d")!;
  let photo: Photo | null = null;

  function draw() {
    if (!photo) return;
    const size = Math.round(Math.min(window.innerWidth * 0.92, 420) - 32) * 2;   // 2x 선명도
    canvas.width = canvas.height = size;
    const { sx, sy, s } = cropRect(photo);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, size, size);
    ctx.drawImage(photo.print, sx, sy, s, s, 0, 0, size, size);
    // 폴라로이드 느낌의 안내 테두리
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 4; ctx.strokeRect(2, 2, size - 4, size - 4);
  }

  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging || !photo) return;
    const rect = canvas.getBoundingClientRect();
    const { s } = cropRect(photo);
    // 화면 px → 소스 px 비율, 그리고 0~1 정규화
    const dx = ((e.clientX - lastX) / rect.width) * s / photo.width;
    const dy = ((e.clientY - lastY) / rect.height) * s / photo.height;
    lastX = e.clientX; lastY = e.clientY;
    updateCrop(photo.id, {
      cx: Math.min(1, Math.max(0, photo.crop.cx - dx)),
      cy: Math.min(1, Math.max(0, photo.crop.cy - dy)),
    });
    draw();
  });
  const end = () => { dragging = false; };
  canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);

  zoom.addEventListener("input", () => { if (photo) { updateCrop(photo.id, { zoom: Number(zoom.value) }); draw(); } });
  reset.addEventListener("click", () => { if (photo) { updateCrop(photo.id, { cx: .5, cy: .5, zoom: 1 }); zoom.value = "1"; draw(); } });
  done.addEventListener("click", () => dlg.close());

  return {
    open(p: Photo) { photo = p; zoom.value = String(p.crop.zoom); dlg.showModal(); draw(); },
  };
}
