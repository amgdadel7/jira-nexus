import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const proxy = {
  '/api': {
    target: 'http://127.0.0.1:8080',
    changeOrigin: true,
    secure: false,
    ws: true,
  },
} as const

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    proxy,
    // Preview is HTTPS on 443 only in cloud/tunnel setups; local dev uses standard ws
    hmr: process.env.VITE_HMR_WSS === 'true'
      ? {
          overlay: false,
          protocol: 'wss',
          clientPort: 443,
        }
      : {
          overlay: false,
        },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    proxy,
  },
})
