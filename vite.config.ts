import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      nodePolyfills({
        include: ['path', 'stream', 'util', 'events', 'buffer', 'process'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
      VitePWA({
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.json',
        includeAssets: ['icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'],
        manifest: {
          id: '/',
          name: 'Digitalis Foundry',
          short_name: 'Digitalis',
          description: 'A decentralized, local-first workspace for makers, engineers, and technologists.',
          theme_color: '#ff5500',
          background_color: '#000000',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ],
          screenshots: [
            {
              src: '/screenshots/mobile-1.avif',
              sizes: '1080x1920',
              type: 'image/avif',
              form_factor: 'narrow',
              label: 'Chat Interface'
            },
            {
              src: '/screenshots/mobile-2.avif',
              sizes: '1080x1920',
              type: 'image/avif',
              form_factor: 'narrow',
              label: 'AI Integration'
            },
            {
              src: '/screenshots/desktop-1.avif',
              sizes: '1920x1080',
              type: 'image/avif',
              form_factor: 'wide',
              label: 'Desktop Dashboard'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,avif,wasm}'],
          navigateFallback: '/index.html',
          maximumFileSizeToCacheInBytes: 10000000,
          cleanupOutdatedCaches: true
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    worker: {
      format: 'es'
    },
    build: {
      chunkSizeWarningLimit: 5000,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
