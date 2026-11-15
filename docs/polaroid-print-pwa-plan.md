# 폴라로이드 모아찍기 인쇄 PWA — 필요정보 & 구조 설계

> 핸드폰 브라우저에서 사이트 접속 → "홈 화면에 추가" → 앱처럼 실행.
> 사진 여러 장 선택 → 4x6인치 한 장에 폴라로이드 12/16/20장 등으로 배치 → JPEG 저장/인쇄.
> **앱스토어 설치 없음, 서버 없음(전부 브라우저 안에서 처리).**

---

## 1. 핵심 결정 사항 (요약)

| 항목 | 결정 | 이유 |
|---|---|---|
| 배포 형태 | PWA (manifest + service worker), 정적 호스팅 | 설치 불필요, 홈 화면 추가 가능, 오프라인 동작 |
| 처리 위치 | 100% 클라이언트(Canvas) | 사진이 서버로 안 나감(개인정보), 서버 비용 0 |
| 호스팅 | GitHub Pages / Cloudflare Pages / Vercel 중 하나 | HTTPS 필수(PWA 조건), 무료 |
| 출력 규격 | 4x6인치 = 102×152mm, **1200×1800px (300dpi)**, 비율 정확히 2:3 | 국내 인화 키오스크·포토몬/찍스/스냅스 등 표준. 비율이 틀리면 잘림 |
| 고해상도 옵션 | 2400×3600px (600dpi) | 손톱 크기 사진은 600dpi가 선명함. 가정용 잉크젯·고급 인화용 |
| 출력 포맷 | JPEG(q 0.92, sRGB) 기본, PDF 선택 | 인화소 업로드는 JPEG, 집에서 인쇄는 PDF/`window.print()` |
| 프레임워크 | Vite + TypeScript (+ Preact 또는 바닐라) | 가볍고 빠름. React/Next 같은 큰 프레임워크 불필요 |

---

## 2. 레이아웃 수치 (4x6 세로, 1200×1800px, 300dpi)

**설계 파라미터**
- 바깥 안전여백: 3mm(36px) — 인화 키오스크는 "꽉 채움(fill)" 모드에서 가장자리 1.5~2mm를 잘라냄
- 폴라로이드 간 간격(거터): 2mm(24px) — 자를 때 가위 들어갈 공간, 선택 시 재단선 표시
- 폴라로이드 비율: **가로 1 : 세로 1.2** (실제 폴라로이드 88×107mm ≈ 1:1.216)
- 사진은 **정사각형**, 좌/우/위 테두리 = 셀 가로의 5%, 아래 여백 = 셀 가로의 25% (두꺼운 하단)

| 장수 | 격자(열×행) | 셀 크기 px | 셀 크기 mm | 사진 한 변 | 하단 여백 |
|---|---|---|---|---|---|
| 6 | 2×3 | 467×560 | 39.5×47.4 | 35.6mm | 9.9mm |
| 9 | 3×3 | 360×432 | 30.5×36.6 | 27.4mm | 7.6mm |
| **12** | 3×4 | 345×414 | 29.2×35.1 | 26.3mm | 7.3mm |
| **16** | 4×4 | 264×317 | 22.4×26.8 | **20.1mm (손톱 크기)** | 5.6mm |
| 20 | 4×5 | 264×317 | 22.4×26.8 | 20.1mm | 5.6mm |
| 24 | 4×6 | 223×268 | 18.9×22.7 | 17.0mm | 4.7mm |
| 30 | 5×6 | 206×248 | 17.5×21.0 | 15.7mm | 4.4mm |

- 20장은 16장과 같은 셀 크기(열 수가 같고 세로 여유가 있음). 격자 아래 남는 공간은 중앙 정렬.
- 가로(6x4) 모드도 같은 함수로 계산 가능 — 열·행만 바꿈.
- 숫자는 모두 하나의 함수 `fitGrid(cols, rows)`에서 나오므로 프리셋 추가가 쉬움.

```ts
// layout.ts 핵심 계산
const PAGE = { w: 1200, h: 1800 };          // 300dpi 4x6 세로
const MARGIN = 36, GUTTER = 24;             // 3mm, 2mm
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
- 재단선(점선) 표시 토글
- 프레임 색 선택(흰색/크림/검정), Instax Mini 비율(사진 46×62 세로형) 프리셋
- 600dpi 출력, PDF 출력(`pdf-lib`)
- IndexedDB로 작업 임시 저장(앱 종료 후 복원)
- 한 번에 여러 장(sheet) 생성: 사진 40장 → 16장 시트 3장 자동 분배

---

## 5. 프로젝트 구조

```
polaroid-print/
├─ index.html                 # 단일 페이지, 뷰포트/apple 메타 포함
├─ manifest.webmanifest       # name, icons, display: standalone, theme_color
├─ vite.config.ts             # vite-plugin-pwa (service worker 자동 생성)
├─ public/
│  └─ icons/                  # 192, 512, apple-touch-icon 180, maskable
└─ src/
   ├─ main.ts                 # 부트스트랩, 화면 라우팅(선택→배치→결과 3단계)
   ├─ state.ts                # 앱 상태: photos[], preset, options, 순서 (단순 스토어)
   ├─ layout.ts               # fitGrid(), 프리셋 테이블, mm↔px 변환
   ├─ photo-picker.ts         # <input multiple> 처리, HEIC 감지 → 지연 변환
   ├─ image-loader.ts         # createImageBitmap 축소 디코드, EXIF 회전, 썸네일/인쇄용 2단계
   ├─ polaroid.ts             # 폴라로이드 1칸 그리기(흰 테두리, 정사각 cover 크롭, 하단 여백, 캡션)
   ├─ render.ts               # 시트 합성: 미리보기(저해상) / 최종(1200×1800 또는 2400×3600)
   ├─ jpeg-dpi.ts             # JPEG Blob에 300dpi 메타 삽입
   ├─ export.ts               # navigator.share → a[download] → img 폴백, window.print()
   ├─ install-guide.ts        # iOS "홈 화면에 추가" 안내, Android beforeinstallprompt
   └─ ui/
      ├─ PhotoGrid.ts         # 선택된 사진 썸네일, 드래그 정렬, 삭제
      ├─ PresetBar.ts         # 9/12/16/20/24, 세로/가로, 빈칸 옵션
      ├─ CropEditor.ts        # 한 장 확대 → 정사각 영역 드래그 조정
      └─ Preview.ts           # 캔버스 미리보기(핀치 줌)
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
5. 캡션: 하단 여백 가운데, 폰트 크기 = `cellW * 0.09`, 색 `#444`.
6. 재단선 옵션: 셀 바깥 거터 중앙에 `#bbb` 점선.

---

## 7. 준비 / 확인 체크리스트

- [ ] 도메인 또는 GitHub Pages 주소(HTTPS)
- [ ] 아이콘 이미지 1장(1024px 정사각) → 192/512/180 자동 생성
- [ ] 앱 이름(한글 노출 이름 + 짧은 이름 12자 이내)
- [ ] 실기기 테스트: iPhone Safari(HEIC·회전·share), Android Chrome(HEIC 원본·install prompt)
- [ ] 실제 인화 테스트 1회: 키오스크 "노컷/여백 맞춤" vs "꽉 채움" 결과 비교 → 안전여백 3mm 조정
- [ ] 16장 시트 600dpi까지 메모리 안정성 (저가 안드로이드 기준)
- [ ] 캡션용 한글 폰트 라이선스(배포 가능 여부)

---

## 8. 선택지와 추천

- **Preact vs 바닐라**: 화면 3개 수준이면 바닐라 TS도 충분. 드래그 정렬·크롭 편집 UI가 늘어나면 Preact(3KB) 추천.
- **PDF 출력**: 인화소 업로드엔 JPEG만 있으면 됨. PDF는 2차.
- **서버**: 필요 없음. 추후 "친구와 링크 공유" 같은 기능이 생기면 그때 스토리지 추가.
