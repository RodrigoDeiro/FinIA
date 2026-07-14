import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// =============================================================================
// FinIA — Vite config
// =============================================================================
//
// Proxy /api → backend (localhost:3000): mantém o frontend SAME-ORIGIN com a
// API em dev. Assim os cookies httpOnly de sessão viajam sem CORS e o SSE
// (/api/v1/events) funciona pelo mesmo túnel.
//
// =============================================================================

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
