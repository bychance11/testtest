import type { Photo, SheetOptions } from "./types";

type Listener = () => void;

export interface AppState {
  photos: Photo[];
  options: SheetOptions;
  selectedId: string | null;     // 순서 바꾸기용 선택
}

const state: AppState = {
  photos: [],
  selectedId: null,
  options: {
    presetId: "16",
    orientation: "portrait",
    dpi: 300,
    emptyMode: "blank",
    showCutLines: false,
    rulerTicks: true,
    frameColor: "#ffffff",
    photoEdge: true,
  },
};

const listeners = new Set<Listener>();
export const getState = () => state;
export function subscribe(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((l) => l()); }

export function addPhotos(photos: Photo[]) { state.photos.push(...photos); emit(); }
export function removePhoto(id: string) {
  const p = state.photos.find((x) => x.id === id);
  if (p) { URL.revokeObjectURL(p.thumbUrl); p.print.close(); }
  state.photos = state.photos.filter((x) => x.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  emit();
}
export function clearPhotos() {
  state.photos.forEach((p) => { URL.revokeObjectURL(p.thumbUrl); p.print.close(); });
  state.photos = []; state.selectedId = null; emit();
}
export function swapPhotos(aId: string, bId: string) {
  const a = state.photos.findIndex((p) => p.id === aId);
  const b = state.photos.findIndex((p) => p.id === bId);
  if (a < 0 || b < 0) return;
  [state.photos[a], state.photos[b]] = [state.photos[b], state.photos[a]];
  emit();
}
export function setSelected(id: string | null) { state.selectedId = id; emit(); }
export function updateCrop(id: string, crop: Partial<Photo["crop"]>) {
  const p = state.photos.find((x) => x.id === id);
  if (p) { p.crop = { ...p.crop, ...crop }; emit(); }
}
export function setOptions(patch: Partial<SheetOptions>) { Object.assign(state.options, patch); emit(); }

/** 칸 수에 맞춰 사진 배정. null = 빈 폴라로이드 */
export function assignSlots(count: number): (Photo | null)[] {
  const { photos, options } = state;
  const slots: (Photo | null)[] = [];
  for (let i = 0; i < count; i++) {
    if (photos.length === 0) { slots.push(null); continue; }
    if (options.emptyMode === "duplicate-first") slots.push(photos[0]);
    else if (options.emptyMode === "repeat") slots.push(photos[i % photos.length]);
    else slots.push(photos[i] ?? null);
  }
  return slots;
}
