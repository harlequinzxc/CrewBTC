import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // §7: content-hashed filenames recorded so the service worker precaches them.
  build: { manifest: true },
  // The sandbox previews the app through a proxied hostname, so Vite must accept it.
  server: { host: '0.0.0.0', allowedHosts: true, port: 5173 },
  preview: { host: '0.0.0.0', allowedHosts: true, port: 4173 },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      // The static file in `public/` is the one index.html links and the §4.4 gate
      // verifies; the plugin mirrors it for the service worker's precache list.
      manifestFilename: 'manifest.json',
      manifest: {
        name: 'Print Studio — Batch PDF Recreator',
        short_name: 'Print Studio',
        description:
          'Batch-parse PDFs and recreate print-ready vector PDFs entirely in your browser.',
        start_url: '/',
        display: 'standalone',
        background_color: '#09090b',
        theme_color: '#09090b',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
