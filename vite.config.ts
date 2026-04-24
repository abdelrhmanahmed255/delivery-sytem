import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    proxy: {
      '/auth': {
        target: 'https://delivry-backend.vercel.app',
        changeOrigin: true,
        secure: true,
      },
      '/admin': {
        target: 'https://delivry-backend.vercel.app',
        changeOrigin: true,
        secure: true,
        // When the browser navigates to an /admin/* page (Accept: text/html),
        // serve index.html so React Router handles it.
        // API calls from Axios use Accept: application/json → proxied normally.
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html';
          }
        },
      },
      '/driver': {
        target: 'https://delivry-backend.vercel.app',
        changeOrigin: true,
        secure: true,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html';
          }
        },
      },
      '/drivers': {
        target: 'https://delivry-backend.vercel.app',
        changeOrigin: true,
        secure: true,
      },
      '/health': {
        target: 'https://delivry-backend.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
