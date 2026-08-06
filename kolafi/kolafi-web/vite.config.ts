import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { cloudflare } from '@cloudflare/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    cloudflare(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      devOptions: {
        enabled: true,
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: null, // 禁用 navigate fallback，避免所有請求都返回 index.html
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\..*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
        ],
      },
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Shpafi Short',
        short_name: 'ShpAfiShort',
        description: 'A short video platform',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-32x32.png',
            sizes: '32x32',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 11000,
    // Docker volume 需要 polling 才能穩定偵測到檔案變更
    watch: {
      usePolling: true,
    },
    // 讓 host 瀏覽器可以連上 HMR
    hmr: {
      host: 'localhost',
      port: 11000,
      clientPort: 11000,
    },
  },
})
