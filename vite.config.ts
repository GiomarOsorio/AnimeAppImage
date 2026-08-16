import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tauri expects a plain frontend build (unlike electron-vite, which also
// bundled the main/preload processes — those are now the Rust side in
// src-tauri, built by cargo instead).
export default defineConfig({
  root: 'src/renderer',
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    // WebKitGTK is evergreen (no legacy-browser target needed) and main.tsx
    // uses a top-level await, which esbuild only allows for modern targets.
    target: 'esnext'
  },
  server: {
    port: 1420,
    strictPort: true
  },
  clearScreen: false
})
