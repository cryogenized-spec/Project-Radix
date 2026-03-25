import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';

import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
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
        injectRegister: 'inline',
        manifestFilename: 'manifest.json',
        devOptions: {
          enabled: true,
          type: 'module'
        },
        includeAssets: [
          'icons/apple-touch-icon.png', 
          'icons/icon-192.png', 
          'icons/icon-512.png'
        ],
        manifest: {
          id: '/?v=radix-1',
          name: 'Project Radix',
          short_name: 'Radix',
          description: 'A secure, local-first P2P chat application.',
          theme_color: '#121212',
          background_color: '#121212',
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
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            }
          ],
          share_target: {
            action: "/share-target",
            method: "POST",
            enctype: "multipart/form-data",
            params: {
              title: "title",
              text: "text",
              url: "url",
              files: [
                {
                  name: "image",
                  accept: ["image/*"]
                }
              ]
            }
          },
          widgets: [
            {
              name: 'Voice Task Entry',
              short_name: 'Voice Task',
              description: 'Quickly add tasks using your voice via Organizer AI.',
              tag: 'voice-task-widget',
              template_url: '/widget-template.json',
              ms_ac_template: '/widget-template.json',
              data_url: '/widget-data.json',
              type: 'application/json'
            }
          ]
        } as any,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,avif,wasm}'],
          navigateFallback: '/index.html',
          maximumFileSizeToCacheInBytes: 50000000,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          importScripts: ['/push-sw.js', '/widget-sw.js', '/share-sw.js']
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
      chunkSizeWarningLimit: 30000,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
