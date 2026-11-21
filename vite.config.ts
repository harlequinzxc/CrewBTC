import { releaseNotesPlugin } from './release-notes-plugin.js'
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
    releaseNotesPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // `public/manifest.json` is the single source of truth and is precached as an
      // asset; disabling generation here avoids a second, drift-prone copy.
      manifest: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'manifest.json'],
    }),
  ],
})
