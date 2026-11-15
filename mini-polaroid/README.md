# 미니폴라로이드 인쇄

사진을 폴라로이드 모양으로 4×6 인치 한 장에 모아 인쇄하는 PWA. 설치 없이 "홈 화면에 추가"로 사용.

## 로컬 실행
```bash
npm install
cp .env.example .env      # Supabase 값 입력 (없으면 클라우드 기능만 꺼진 채 동작)
npm run dev
```

## 배포 (Netlify)
1. 이 저장소를 Netlify 에 연결. 루트의 `netlify.toml` 이 `mini-polaroid/` 를 base 로 빌드함.
2. Site configuration → Environment variables 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 등록.
3. 배포 후 HTTPS 주소로 접속 → 홈 화면에 추가.

## Supabase 설정
1. 새 프로젝트 생성 → SQL Editor 에서 `supabase/migrations/0001_sheets.sql` 실행.
2. Authentication → Providers → **Anonymous sign-ins** 활성화 (로그인 없이 보관함 사용).
3. Project Settings → API 의 URL / anon key 를 환경변수로.

사진 원본은 서버로 보내지 않음. 완성된 시트 JPEG 만 "클라우드에 보관" 을 누른 경우 비공개 버킷에 저장됨.

## 구조
자세한 설계는 `../docs/polaroid-print-pwa-plan.md` 참고.
