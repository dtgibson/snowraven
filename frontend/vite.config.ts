/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  test: {
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/weather': 'http://localhost:1620',
      '/checklists': 'http://localhost:1620',
      '/health': 'http://localhost:1620',
      '/version': 'http://localhost:1620',
      '/nominatim': 'http://localhost:1620',
      '/taxonomy': 'http://localhost:1620',
      '/settings': 'http://localhost:1620',
      '/map': 'http://localhost:1620',
      '/stats': 'http://localhost:1620',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'vendor-react'
          if (id.includes('node_modules/recharts/')) return 'vendor-recharts'
          // maplibre is shared by the (lazy) Map Explorer + Species Detail tabs —
          // keep it in one chunk so it isn't duplicated across their lazy bundles.
          if (id.includes('node_modules/maplibre-gl')) return 'vendor-maplibre'
        },
      },
    },
  },
})
