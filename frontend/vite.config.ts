import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/weather': 'http://localhost:1620',
      '/health': 'http://localhost:1620',
      '/version': 'http://localhost:1620',
      '/nominatim': 'http://localhost:1620',
      '/taxonomy': 'http://localhost:1620',
      '/settings': 'http://localhost:1620',
      '/map': 'http://localhost:1620',
      '/stats': 'http://localhost:1620',
    },
  },
})
