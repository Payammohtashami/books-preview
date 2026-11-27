import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    host: true, // IPv4 و IPv6 هر دو؛ از گوشی (همان وای‌فای) هم قابل‌دسترس است
    port: 5173,
    open: true, // مرورگر را خودکار باز می‌کند
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt", // کاربر تصمیم می‌گیرد چه زمانی نسخه‌ی جدید فعال شود
      includeAssets: ["icons/*.png", "icons/icon.svg"],
      manifest: {
        name: "کتاب درسی تعاملی",
        short_name: "کتاب تعاملی",
        description: "کتاب‌های درسی سه‌بعدی و تعاملی، آفلاین",
        lang: "fa",
        dir: "rtl",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#0f172a",
        theme_color: "#0f766e",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,webp,woff2,wasm,json}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // مدل‌های سه‌بعدی: یک‌بار دانلود، همیشه آفلاین
            urlPattern: ({ url }) => /\.(glb|gltf|ktx2|hdr)$/i.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "models-v1",
              expiration: { maxEntries: 200 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // فایل کتاب عمداً با پسوند .txt ذخیره می‌شود تا افزونه‌های مدیریت دانلود (مثل IDM) آن را قاپ نزنند
            urlPattern: ({ url }) => /^\/content\/.+\/book\.(txt|pdf)$/i.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "books-v1",
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/content/") && url.pathname.endsWith(".json"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "content-json-v1" },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
