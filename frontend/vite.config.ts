import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'pwa-64x64.png'],
        manifest: {
          name: 'Dermora',
          short_name: 'Dermora',
          description: 'AI-powered psychodermatology wellness companion',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          orientation: 'portrait',
          background_color: '#FFF5F5',
          theme_color: '#FFF5F5',
          icons: [
            { src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Explicitly exclude the backend/API origin from any runtime caching.
          // Only same-origin static build assets should be precached.
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [], // intentionally empty — do not cache API calls
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('@google/genai') || id.includes('@google/generative-ai')) {
              return 'google-genai';
            }
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          }
        }
      }
    }
  };
});
