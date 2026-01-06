import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/profile': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/profiles': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/agent': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/events': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/annotations': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/views': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/voice': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/chat': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
})
