import { registerSW } from "virtual:pwa-register";
import { PRESETS, computeLayout, getPreset, pxToMm } from "./layout";
import { addPhotos, assignSlots, clearPhotos, getState, removePhoto, setOptions, setSelected, subscribe, swapPhotos } from "./state";
import { loadPhotos } from "./image-loader";
import { renderFinalJpeg, renderPreview } from "./render";
import { withDpi } from "./jpeg-dpi";
import { filename, printBlob, saveOrShare } from "./export";
import { cloudEnabled, deleteSheet, listSheets, signedUrl, uploadSheet } from "./supabase";
import { setupInstallGuide } from "./install-guide";
import { setupCropEditor } from "./ui/CropEditor";
import type { Dpi, EmptyMode, Orientation } from "./types";

registerSW({ immediate: true });

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const fileInput = $<HTMLInputElement>("fileInput");
const photoGrid = $("photoGrid");
const photoCount = $("photoCount");
const progress = $("progress");
const clearBtn = $<HTMLButtonElement>("clearBtn");
const presetBar = $("presetBar");
const preview = $<HTMLCanvasElement>("preview");
const previewWrap = $("previewWrap");
const sizeInfo = $("sizeInfo");
const status = $("status");
const saveBtn = $<HTMLButtonElement>("saveBtn");
const printBtn = $<HTMLButtonElement>("printBtn");
const cloudBtn = $<HTMLButtonElement>("cloudBtn");
const fallbackWrap = $("fallbackWrap");
const fallbackImg = $<HTMLImageElement>("fallbackImg");

const crop = setupCropEditor();
setupInstallGuide($("installBanner"), $<HTMLButtonElement>("installBtn"), $("installText"));

// ---------- 1. 사진 선택 ----------
fileInput.addEventListener("change", async () => {
  const files = Array.from(fileInput.files ?? []);
  fileInput.value = "";
  if (!files.length) return;
  progress.hidden = false;
  const photos = await loadPhotos(files, (d, t) => (progress.textContent = `불러오는 중 ${d}/${t}`));
  progress.hidden = true;
  addPhotos(photos);
});
clearBtn.addEventListener("click", () => { if (confirm("선택한 사진을 모두 지울까요?")) clearPhotos(); });

function renderThumbs() {
  const { photos, selectedId } = getState();
  photoCount.textContent = `${photos.length}장`;
  clearBtn.hidden = photos.length === 0;
  photoGrid.innerHTML = "";
  photos.forEach((p, i) => {
    const el = document.createElement("div");
    el.className = "thumb" + (p.id === selectedId ? " selected" : "");
    el.innerHTML = `<img src="${p.thumbUrl}" alt=""><span class="idx">${i + 1}</span>
      <div class="act"><button data-crop title="자르기">✂</button><button data-del title="삭제">✕</button></div>`;
    el.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-del]")) return removePhoto(p.id);
      if (t.closest("[data-crop]")) return crop.open(p);
      if (selectedId && selectedId !== p.id) { swapPhotos(selectedId, p.id); setSelected(null); }
      else setSelected(selectedId === p.id ? null : p.id);
    });
    photoGrid.appendChild(el);
  });
}

// ---------- 2. 배치 ----------
PRESETS.forEach((p) => {
  const b = document.createElement("button");
  b.className = "chip"; b.textContent = p.label; b.dataset.id = p.id;
  b.addEventListener("click", () => setOptions({ presetId: p.id }));
  presetBar.appendChild(b);
});
$<HTMLSelectElement>("orientation").addEventListener("change", (e) => setOptions({ orientation: (e.target as HTMLSelectElement).value as Orientation }));
$<HTMLSelectElement>("emptyMode").addEventListener("change", (e) => setOptions({ emptyMode: (e.target as HTMLSelectElement).value as EmptyMode }));
$<HTMLSelectElement>("dpi").addEventListener("change", (e) => setOptions({ dpi: Number((e.target as HTMLSelectElement).value) as Dpi }));
$<HTMLSelectElement>("frameColor").addEventListener("change", (e) => setOptions({ frameColor: (e.target as HTMLSelectElement).value }));
$<HTMLInputElement>("cutLines").addEventListener("change", (e) => setOptions({ showCutLines: (e.target as HTMLInputElement).checked }));
$<HTMLInputElement>("photoEdge").addEventListener("change", (e) => setOptions({ photoEdge: (e.target as HTMLInputElement).checked }));

function currentLayout(dpi?: Dpi) {
  const { options } = getState();
  return computeLayout(getPreset(options.presetId), options.orientation, dpi ?? options.dpi);
}

// ---------- 3. 미리보기 ----------
let raf = 0;
function schedulePreview() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const { options } = getState();
    const L = currentLayout(300);                      // 미리보기는 항상 300dpi 좌표계
    const slots = assignSlots(L.cells.length);
    const cssW = Math.min(previewWrap.clientWidth - 24, options.orientation === "portrait" ? 340 : 520);
    renderPreview(preview, L, slots, options, cssW);
    const d = 300;
    sizeInfo.textContent =
      `폴라로이드 1개 ${pxToMm(L.cellW, d).toFixed(1)}×${pxToMm(L.cellH, d).toFixed(1)}mm · 사진 ${pxToMm(L.img, d).toFixed(1)}mm · ` +
      `출력 ${options.dpi === 600 ? "2400×3600" : "1200×1800"}px`;
    presetBar.querySelectorAll<HTMLButtonElement>(".chip").forEach((c) => c.classList.toggle("on", c.dataset.id === options.presetId));
  });
}

subscribe(() => { renderThumbs(); schedulePreview(); });
window.addEventListener("resize", schedulePreview);
renderThumbs(); schedulePreview();

// ---------- 저장 / 인쇄 / 클라우드 ----------
async function buildFinal(): Promise<Blob> {
  const { options } = getState();
  const L = currentLayout();
  const slots = assignSlots(L.cells.length);
  const raw = await renderFinalJpeg(L, slots, options);
  return withDpi(raw, options.dpi);
}

function busy(on: boolean, msg = "") {
  [saveBtn, printBtn, cloudBtn].forEach((b) => (b.disabled = on));
  status.textContent = msg;
}

saveBtn.addEventListener("click", async () => {
  if (!getState().photos.length) return (status.textContent = "먼저 사진을 골라주세요.");
  busy(true, "이미지 만드는 중…");
  try {
    const blob = await buildFinal();
    const { options } = getState();
    const r = await saveOrShare(blob, filename(options.presetId, options.dpi));
    if (r === "fallback") {
      fallbackImg.src = URL.createObjectURL(blob); fallbackWrap.hidden = false;
      busy(false, "");
    } else busy(false, r === "shared" ? "공유 시트에서 \"이미지 저장\"을 누르면 사진앱에 저장됩니다." : "다운로드했습니다.");
  } catch (e) { busy(false, `실패: ${(e as Error).message}`); }
});

printBtn.addEventListener("click", async () => {
  if (!getState().photos.length) return (status.textContent = "먼저 사진을 골라주세요.");
  busy(true, "이미지 만드는 중…");
  try {
    const blob = await buildFinal();
    const ok = printBlob(blob, getState().options.orientation === "landscape");
    busy(false, ok ? "인쇄 창에서 용지를 4×6(102×152mm), 여백 없음으로 선택하세요." : "팝업이 차단되었습니다. 저장 후 사진앱에서 인쇄해 주세요.");
  } catch (e) { busy(false, `실패: ${(e as Error).message}`); }
});

if (cloudEnabled) {
  cloudBtn.hidden = false;
  $("cloudSection").hidden = false;
  cloudBtn.addEventListener("click", async () => {
    if (!getState().photos.length) return (status.textContent = "먼저 사진을 골라주세요.");
    busy(true, "업로드 중…");
    try {
      const blob = await buildFinal();
      await uploadSheet(blob, getState().options, getState().photos.length);
      busy(false, "보관함에 저장했습니다.");
      refreshCloud();
    } catch (e) { busy(false, `업로드 실패: ${(e as Error).message}`); }
  });
  $("refreshCloud").addEventListener("click", refreshCloud);
  refreshCloud();
}

async function refreshCloud() {
  const ul = $("cloudList");
  try {
    const rows = await listSheets();
    ul.innerHTML = rows.length ? "" : `<li class="muted">아직 보관한 인쇄물이 없어요.</li>`;
    for (const r of rows) {
      const li = document.createElement("li");
      const when = new Date(r.created_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
      li.innerHTML = `<span>${when} · ${r.preset}장 · ${r.orientation === "portrait" ? "세로" : "가로"} · ${r.dpi}dpi</span>
        <span class="row"><button class="btn small" data-open>열기</button><button class="btn ghost small" data-del>삭제</button></span>`;
      li.querySelector("[data-open]")!.addEventListener("click", async () => window.open(await signedUrl(r.storage_path), "_blank"));
      li.querySelector("[data-del]")!.addEventListener("click", async () => { if (confirm("삭제할까요?")) { await deleteSheet(r); refreshCloud(); } });
      ul.appendChild(li);
    }
  } catch (e) { ul.innerHTML = `<li class="muted">불러오기 실패: ${(e as Error).message}</li>`; }
}
