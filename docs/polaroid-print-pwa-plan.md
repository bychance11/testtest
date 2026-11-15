# 폴라로이드 모아찍기 인쇄 PWA — 필요정보 & 구조 설계

> 핸드폰 브라우저에서 사이트 접속 → "홈 화면에 추가" → 앱처럼 실행.
> 사진 여러 장 선택 → 4x6인치 한 장에 폴라로이드 12/16/20장 등으로 배치 → JPEG 저장/인쇄.
> **앱스토어 설치 없음, 서버 없음(전부 브라우저 안에서 처리).**

---

## 1. 핵심 결정 사항 (요약)

| 항목 | 결정 | 이유 |
|---|---|---|
| 배포 형태 | PWA (manifest + service worker), 정적 호스팅 | 설치 불필요, 홈 화면 추가 가능, 오프라인 동작 |
| 처리 위치 | 100% 클라이언트(Canvas + IndexedDB) | 사진이 서버로 안 나감(개인정보), 서버 비용 0 |
| 호스팅 | **Netlify** (루트 `netlify.toml`, base=`mini-polaroid/`) | HTTPS 자동, 환경변수 UI, 무료 |
| 백엔드 | **없음.** 보관함은 기기 안 IndexedDB (최근 20개) | 서버·계정·환경변수 제로. 사진앱이 1차 보관소이고 앱 안 보관함은 '다시 열기' 용도 |
| 앱 이름 | **미니폴라로이드 인쇄** (짧은 이름: 미니폴라) | manifest `name` / `short_name` |
| 아이콘 | 자동 생성(검정 배경 + 폴라로이드 카드) 192/512/maskable/180 | `public/icons/` — 나중에 교체 가능 |
| 출력 규격 | 4x6인치 = 102×152mm, **1200×1800px (300dpi)**, 비율 정확히 2:3 | 국내 인화 키오스크·포토몬/찍스/스냅스 등 표준. 비율이 틀리면 잘림 |
| 고해상도 옵션 | 2400×3600px (600dpi) | 손톱 크기 사진은 600dpi가 선명함. 가정용 잉크젯·고급 인화용 |
| 출력 포맷 | JPEG(q 0.92, sRGB) 기본, PDF 선택 | 인화소 업로드는 JPEG, 집에서 인쇄는 PDF/`window.print()` |
| 프레임워크 | Vite + TypeScript (+ Preact 또는 바닐라) | 가볍고 빠름. React/Next 같은 큰 프레임워크 불필요 |

---

## 2. 레이아웃 수치 (4x6 세로, 1200×1800px, 300dpi)

**설계 파라미터** (결정: 안전여백은 인쇄 한 장의 **바깥쪽에만**, 폴라로이드 사이 간격은 0)
- 바깥 안전여백: **5mm**(59px) — 자 맞춤선 0.5cm 가 들어갈 자리이면서, 키오스크가 "꽉 채움" 모드에서 가장자리 1.5~2mm를 잘라내도 폴라로이드가 다치지 않음
- **자 맞춤선**: 종이 네 변 가장자리에서 안쪽으로 0.5cm 짜리 얇은 검은 선. 모든 칸 경계 위치(세로 열+1개, 가로 행+1개)에 찍힘. 마주보는 변의 선을 자로 이어 칼로 자른다. **선은 바깥 여백에만 있고 사진·폴라로이드 영역에는 없음**
- 폴라로이드 사이 간격: **0mm** — 칸끼리 맞닿음. 각 칸의 흰 테두리가 곧 재단 여유라 가위로 경계선을 따라 자르면 됨. 재단선(점선) 표시는 옵션
- 폴라로이드 비율: **가로 1 : 세로 1.2** (실제 폴라로이드 88×107mm ≈ 1:1.216)
- 사진은 **정사각형**, 좌/우/위 테두리 = 셀 가로의 5%, 아래 여백 = 셀 가로의 25% (두꺼운 하단)
- 격자는 항상 페이지 중앙 정렬 (남는 공간은 위아래/좌우로 균등 분배)

| 장수 | 격자(열×행) | 셀 크기 px | 셀 크기 mm | 사진 한 변 | 하단 여백 |
|---|---|---|---|---|---|
| 6 | 2×3 | 467×560 | 39.5×47.4 | 35.6mm | 9.8mm |
| 9 | 3×3 | 360×432 | 30.5×36.6 | 27.4mm | 7.6mm |
| **12** | 3×4 | 350×420 | 29.6×35.6 | 26.6mm | 7.5mm |
| **16** | 4×4 | 270×324 | 22.9×27.4 | **20.5mm (손톱 크기)** | 5.8mm |
| 20 | 4×5 | 270×324 | 22.9×27.4 | 20.5mm | 5.8mm |
| 24 | 4×6 | 233×279 | 19.7×23.6 | 17.7mm | 4.9mm |
| 30 | 5×6 | 216×259 | 18.3×21.9 | 16.4mm | 4.6mm |

- 20장은 16장과 같은 셀 크기(열 수가 같고 세로 여유가 있음). 격자 아래 남는 공간은 중앙 정렬.
- 가로(6x4) 모드도 같은 함수로 계산 가능 — 열·행만 바꿈.
- 숫자는 모두 하나의 함수 `computeLayout()`에서 나오므로 프리셋 추가가 쉬움. (구현: `mini-polaroid/src/layout.ts`)

```ts
// layout.ts 핵심 계산 (개념 코드 — 실제 구현은 mini-polaroid/src/layout.ts)
const PAGE = { w: 1200, h: 1800 };          // 300dpi 4x6 세로
const MARGIN = 59, GUTTER = 0;              // 바깥 5mm, 칸 사이 0
const RATIO = 1.2, SIDE = 0.05;             // 셀 비율, 테두리 비율

export function fitGrid(cols: number, rows: number) {
  const aw = PAGE.w - 2 * MARGIN - (cols - 1) * GUTTER;
  const ah = PAGE.h - 2 * MARGIN - (rows - 1) * GUTTER;
  const cellW = Math.min(aw / cols, (ah / rows) / RATIO);
  const cellH = cellW * RATIO;
  const gridW = cols * cellW + (cols - 1) * GUTTER;
  const gridH = rows * cellH + (rows - 1) * GUTTER;
  const x0 = (PAGE.w - gridW) / 2, y0 = (PAGE.h - gridH) / 2;   // 중앙 정렬
  const img = cellW * (1 - 2 * SIDE);                            // 정사각 사진 한 변
  return { cellW, cellH, img, border: cellW * SIDE,
    cells: Array.from({ length: cols * rows }, (_, i) => ({
      x: x0 + (i % cols) * (cellW + GUTTER),
      y: y0 + Math.floor(i / cols) * (cellH + GUTTER) })) };
}
```

---

## 3. 꼭 알아야 하는 기술 제약 (모바일 브라우저)

### 3-1. PWA / 홈 화면 추가
- **HTTPS 필수.** `manifest.webmanifest`에 `display: "standalone"`, 아이콘 192/512px, `theme_color`.
- **iOS(Safari)**: 설치 배너가 없음. 사용자가 공유 버튼 → "홈 화면에 추가"를 직접 눌러야 함 → 앱 안에 **안내 화면** 필요. `<meta name="apple-mobile-web-app-capable">`, `apple-touch-icon` 추가.
- **Android(Chrome)**: `beforeinstallprompt` 이벤트로 "설치" 버튼 제공 가능.
- Service worker는 **앱 셸(html/js/css)만 캐시**. 사진은 캐시하지 않음.

### 3-2. 사진 선택
- `<input type="file" accept="image/*" multiple>` 하나로 iOS/Android 모두 사진앱 다중 선택 열림. 별도 권한 코드 불필요.
- **HEIC**: iOS Safari는 파일 입력 시 자동으로 JPEG로 변환해 넘겨줌. Android는 HEIC 원본이 올 수 있음 → 디코드 실패 시 `heic2any` 라이브러리를 **지연 로드**해 변환(기본 번들에는 포함 안 함).
- **EXIF 회전**: `createImageBitmap(file, { imageOrientation: "from-image" })` 사용. 안 되는 브라우저는 `<img>`로 디코드(모바일 브라우저는 `<img>`에 회전 자동 적용). 반드시 실기기로 확인.

### 3-3. 메모리 (가장 흔한 실패 원인)
- 12MP 사진 1장 디코드 = 약 48MB. 16장 원본을 다 들고 있으면 iOS Safari가 탭을 죽임.
- **해결**: 선택 즉시 `createImageBitmap(file, { resizeWidth, resizeHeight })`로 **셀 크기(최대 ~700px)로 축소 후 원본 해제**. 미리보기용 썸네일(~200px)과 인쇄용(~700px) 두 단계.
- iOS Canvas 한 장 한도: 약 4096×4096(1,670만 px). 2400×3600(864만 px)까지는 안전. 그 이상은 피함.
- 합성은 `OffscreenCanvas`(지원 시) 또는 화면 밖 `<canvas>` 1개만 사용.

### 3-4. 저장 / 인쇄 경로
| 경로 | 방법 | 비고 |
|---|---|---|
| 사진앱에 저장 (주 경로) | `navigator.share({ files: [File] })` | iOS/Android 모두 "이미지 저장" 가능. **사용자 탭 이벤트 안에서** 호출해야 함 |
| 다운로드 (대체) | `<a download>` + Blob URL | iOS 독립실행(standalone) 모드에선 불안정 → share 우선 |
| 길게 눌러 저장 | 결과 `<img>` 표시 | 최후 수단 |
| 집에서 인쇄 | `window.print()` + `@page { size: 4in 6in; margin: 0 }` | AirPrint/모바일 프린터 |
| 인화소 | 저장된 JPEG를 포토몬/찍스/스냅스 앱 또는 키오스크에 업로드 | "꽉 채움"이 아닌 **"여백 없이 맞춤/노컷"** 옵션을 고르라고 안내 |

- JPEG에 **DPI 메타(JFIF density 300)**를 심어주면 포토샵·일부 키오스크가 4x6으로 바로 인식. 바이트 몇 개 수정하는 작은 유틸(`jpeg-dpi.ts`)로 가능. 대부분 키오스크는 DPI 무시하고 비율만 보므로 **2:3 비율이 더 중요**.

---

## 4. 기능 범위

### MVP (1차)
1. 사진 다중 선택 (갤러리)
2. 장수 프리셋: 9 / 12 / 16 / 20 / 24 (+ 세로/가로 전환)
3. 빈 칸 처리 옵션: ① 빈 흰 폴라로이드 ② 사진 반복 채움 ③ **한 장을 전부 복제**(같은 사진 16장 — 수요 많음)
4. 각 사진 정사각 자동 크롭(center cover) + 탭하여 **크롭 위치 조정**(드래그)
5. 순서 변경 (길게 눌러 드래그) / 삭제
6. 실시간 미리보기 (저해상도 캔버스)
7. 1200×1800 JPEG 생성 → 공유/저장
8. 홈 화면 추가 안내 + 오프라인 동작

### 2차
- 하단 여백에 **손글씨풍 캡션/날짜** (폰트 번들, 폰트 크기 자동)
- ~~재단선(점선) 표시 토글~~ → 자 맞춤선으로 구현 완료
- 프레임 색 선택(흰색/크림/검정), Instax Mini 비율(사진 46×62 세로형) 프리셋
- 600dpi 출력, PDF 출력(`pdf-lib`)
- IndexedDB로 **선택한 사진·배치 상태**도 임시 저장(앱 종료 후 복원) — 지금은 완성 시트만 보관
- 한 번에 여러 장(sheet) 생성: 사진 40장 → 16장 시트 3장 자동 분배

---

## 4-1. 보관함: 서버 없이 기기 안에 (IndexedDB)

**원칙**: 사진은 어디에도 업로드하지 않는다. 저장/인쇄를 누를 때 완성된 시트 JPEG 를 **이 기기의 IndexedDB** 에 자동 보관(최근 20개)하고, 목록에서 다시 "저장/공유"할 수 있다.

| 항목 | 내용 |
|---|---|
| 저장소 | IndexedDB `mini-polaroid` / 스토어 `sheets` (id, createdAt, preset, orientation, dpi, photoCount, blob) |
| 용량 | 300dpi 시트 ≈ 0.5~1MB, 600dpi ≈ 2~3MB → 20개여도 수십 MB. iOS Safari 사이트당 허용량 안 |
| 한계 | 기기를 바꾸거나 Safari 데이터를 지우면 사라짐 → UI 에 "이 기기 안에만 저장" 명시. 홈 화면 앱을 **오래 안 쓰면(iOS 약 7일) 지워질 수 있음** |
| 확장 | 나중에 "링크로 친구에게 보내기"가 필요하면 Netlify Blobs + Functions 를 `storage.ts` 와 같은 함수 모양으로 추가 |

### 아이폰에서 시작하는 방법 (나 / 친구 동일)
1. 사이트를 **Netlify 에 한 번 배포**해 HTTPS 주소를 얻는다. 호스팅은 필요하다 — 없어지는 건 서버(DB)이지 사이트 파일을 내려주는 곳은 있어야 한다.
2. 아이폰 Safari 로 그 주소 접속 → 하단 공유(⬆) → "홈 화면에 추가".
3. 홈 화면 아이콘으로 실행. 이후엔 오프라인에서도 열린다(앱 셸이 캐시됨).
4. 친구는 주소만 받아서 2~3번을 하면 끝. 계정·설치 파일·앱스토어 없음.

호스팅 없이 쓰는 방법은 사실상 없다. 아이폰은 로컬 HTML 파일을 PWA 로 설치할 수 없고, HTTPS 가 아니면 service worker 와 홈 화면 추가가 동작하지 않는다. Netlify 무료 플랜이면 비용은 0 이다.

---

## 5. 프로젝트 구조

```
testtest/
├─ netlify.toml                  # base=mini-polaroid, publish=dist, SPA 리다이렉트, sw.js no-cache (환경변수 없음)
├─ docs/polaroid-print-pwa-plan.md
└─ mini-polaroid/
   ├─ index.html                 # 단일 페이지(선택→배치→미리보기/저장), apple 메타, 크롭 dialog
   ├─ vite.config.ts             # vite-plugin-pwa: manifest(미니폴라로이드 인쇄) + service worker
   ├─ public/icons/              # 192, 512, 512-maskable, apple-touch-icon(180)
   └─ src/
      ├─ main.ts                 # UI 바인딩, 미리보기 스케줄, 저장/인쇄, 최근 인쇄물 목록
      ├─ types.ts                # Photo, Crop, SheetOptions
      ├─ state.ts                # 상태 스토어(사진 목록, 옵션, 순서 교환, 칸 배정 assignSlots)
      ├─ layout.ts               # PRESETS, computeLayout(): 바깥여백 5mm(자 맞춤선 자리), 간격 0, 비율 1.2
      ├─ image-loader.ts         # HEIC 지연 변환, <img> 디코드(EXIF 자동), 썸네일/인쇄용 축소, 순차 처리
      ├─ polaroid.ts             # 한 칸 그리기(프레임, 정사각 cover 크롭, 둘레선), 재단선
      ├─ render.ts               # drawSheet(scale) 공용 → 미리보기 / OffscreenCanvas 최종 JPEG
      ├─ jpeg-dpi.ts             # JFIF 밀도 300/600dpi 기록
      ├─ export.ts               # navigator.share → a[download] → 길게누르기 폴백, window.print 4x6
      ├─ storage.ts              # IndexedDB 보관함: saveSheet/listSheets/deleteSheet/clearSheets
      ├─ install-guide.ts        # iOS 수동 안내 / Android beforeinstallprompt
      ├─ style.css
      └─ ui/CropEditor.ts        # 드래그 + 확대로 정사각 크롭 위치 조정
```

### 데이터 모델
```ts
interface Photo {
  id: string;
  file: File;                 // 원본 (디코드 후 참조만 유지)
  thumb: ImageBitmap;         // ~200px 미리보기
  print?: ImageBitmap;        // ~700px 인쇄용 (렌더 시점에 생성, 완료 후 close())
  crop: { cx: number; cy: number; zoom: number };  // 정사각 크롭 중심(0~1), 배율(1~3)
  caption?: string;
}
interface Sheet {
  preset: { cols: number; rows: number };
  orientation: "portrait" | "landscape";
  dpi: 300 | 600;
  emptyMode: "blank" | "repeat" | "duplicate-first";
  showCutLines: boolean;
  frameColor: string;         // "#ffffff"
  slots: (Photo["id"] | null)[];   // 칸별 사진 배정
}
```

### 처리 흐름
```
[사진 선택] input multiple
   → image-loader: 파일마다 축소 디코드(썸네일) → state.photos 추가
[배치 화면]
   → PresetBar 변경 → layout.fitGrid → Preview 저해상 렌더(디바운스)
   → 순서/크롭 수정 → state 갱신 → 재렌더
[저장]
   → render: 인쇄용 비트맵 생성(칸 크기만큼만) → OffscreenCanvas 1200×1800 합성
   → canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 })
   → jpeg-dpi: 300dpi 메타 삽입
   → export: navigator.share(files) → 실패 시 download → 실패 시 img 표시
```

---

## 6. 폴라로이드 1칸 그리기 규칙 (`polaroid.ts`)

1. 셀 전체를 프레임 색(흰색)으로 채움. 인쇄용이므로 **그림자·둥근 모서리 없음**(가위로 자르면 의미 없음). 미리보기에만 살짝 그림자 가능.
2. 사진 영역: `(x+border, y+border, img, img)` 정사각.
3. 사진은 `cover` 방식으로 정사각에 맞춤 + `crop.cx/cy/zoom` 반영. `drawImage(src, sx, sy, sw, sh, dx, dy, img, img)`.
4. 사진 둘레에 아주 얇은 회색(#ddd) 1px 선 — 흰 배경에서 사진 경계가 보이게. 선택 옵션.
5. 캡션(2차): 하단 여백 가운데, 폰트 크기 = `cellW * 0.09`, 색 `#444`.
6. 자 맞춤선(기본 켬): 종이 가장자리에서 0.5cm 길이 검은 1px 선(600dpi 는 2px), 칸 경계마다. 격자 안으로는 그리지 않음 (`drawRulerTicks`).
7. 칸 사이 점선(기본 끔): 사진 위를 가로지르는 옅은 점선. 자 맞춤선만으로 부족할 때 보조용.

---

## 7. 준비 / 확인 체크리스트

- [x] 호스팅: Netlify (저장소 연결만 하면 됨, 환경변수 없음)
- [x] 아이콘: 임시 자동 생성본 적용 (추후 교체 시 `public/icons/` 4개 파일만 바꾸면 됨)
- [x] 앱 이름: 미니폴라로이드 인쇄 / 미니폴라
- [ ] 실기기 테스트: iPhone Safari(HEIC·회전·share), Android Chrome(HEIC 원본·install prompt)
- [ ] 실제 인화 테스트 1회: 키오스크 "노컷/여백 맞춤" vs "꽉 채움" 결과 비교 → 바깥 안전여백 5mm 조정 (`layout.ts` 의 `MARGIN_MM`, 자 맞춤선 길이 `TICK_MM` 보다 작게 하지 말 것)
- [ ] 16장 시트 600dpi까지 메모리 안정성 (저가 안드로이드 기준)
- [ ] 캡션용 한글 폰트 라이선스(배포 가능 여부)

---

## 8. 선택지와 추천

- **Preact vs 바닐라**: 화면 3개 수준이면 바닐라 TS도 충분. 드래그 정렬·크롭 편집 UI가 늘어나면 Preact(3KB) 추천.
- **PDF 출력**: 인화소 업로드엔 JPEG만 있으면 됨. PDF는 2차.
- **서버**: 필요 없음. 추후 "친구와 링크 공유" 같은 기능이 생기면 그때 스토리지 추가.
