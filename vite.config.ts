import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'NeuroLab — Treinamento Cognitivo',
        short_name: 'NeuroLab',
        description: 'Treinamento cognitivo científico adaptativo em 6 domínios e 12 exercícios',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/sb': {
        target: 'http://127.0.0.1:54321',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sb/, ''),
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/sb': {
        target: 'http://127.0.0.1:54321',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sb/, ''),
      },
    },
  },
});
