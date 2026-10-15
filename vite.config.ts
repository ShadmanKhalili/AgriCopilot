import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || ""),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: '/',
          name: "Agri-Copilot Bangladesh",
          short_name: 'AgriCopilot',
          description: "AI-Powered Climate Intelligence & Crop Diagnostics for Cox's Bazar and Bangladesh Agriculture",
          theme_color: '#064e3b',
          background_color: '#064e3b',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // In production only precache the app shell. Precaching every vendor
          // chunk previously made the service worker download ~2.8 MB before the
          // app was usable, which is a serious problem for farmers on slow rural
          // connections. Hashed assets are cached on demand at runtime instead.
          // In dev the output dir contains no built assets, so keep the full glob
          // there (otherwise workbox warns about an unmatched pattern).
          globPatterns: mode === 'production'
            ? ['**/*.{css,html,ico,png,svg,woff,woff2}']
            : ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/node_modules/**'],
          maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // Hashed build assets (index-f1fMjefh.js) are immutable, so cache them
              // on first use. This keeps the app offline-capable without making the
              // service worker precache megabytes of vendor JS up front.
              urlPattern: /\/assets\/.*\.[0-9a-f]{8}\.(js|css)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'agri-build-assets',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Real-time dynamic weather forecasts must NEVER be hijacked by stale Service Worker cache
              urlPattern: /^\/api\/(daily-forecast|weathernext-3|weather-next)/i,
              handler: 'NetworkOnly',
            },
            {
              // Historical climate multi-year archives can be cached safely for 7 days
              urlPattern: /^\/api\/historical-data/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'agri-climate-archive-cache',
                networkTimeoutSeconds: 6,
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-motion': ['motion/react'],
            // NOTE: recharts is deliberately NOT pinned to a manual chunk. Pinning it
            // made the entry statically import it, pulling ~109 KB gzip of charting
            // library into the initial load even though only lazy tool screens draw
            // charts. Rollup now emits a shared chunk that lazy screens load on demand.
            'vendor-icons': ['lucide-react'],
            'vendor-markdown': ['react-markdown'],
            // Auth only. `firebase/firestore` is intentionally NOT pinned here:
            // pinning it forced the Firestore SDK into the eagerly-loaded chunk even
            // after all its consumers became dynamic imports.
            'vendor-firebase': ['firebase/app', 'firebase/auth']
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
