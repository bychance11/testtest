import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "미니폴라로이드 인쇄",
        short_name: "미니폴라",
        description: "사진을 폴라로이드 모양으로 4x6 한 장에 모아 인쇄",
        lang: "ko",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        background_color: "#f4f1ea",
        theme_color: "#222222",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // 앱 셸만 캐시. 사진·Supabase 요청은 캐시하지 않음
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        globIgnores: ["**/heic2any*"],   // 1.3MB HEIC 변환기는 필요할 때만 받음
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
});
