import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        proxyTimeout: 300000,  // 5 minutes — for slow image gen & large PDF uploads
        timeout: 300000,
        // Disable proxy buffering so SSE streams work on first request
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('X-Forwarded-For', '127.0.0.1')
          })
          proxy.on('proxyRes', (proxyRes) => {
            // Force no-buffer so SSE chunks reach the client immediately
            proxyRes.headers['x-accel-buffering'] = 'no'
          })
        }
      }
    }
  }
})
