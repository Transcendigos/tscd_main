// frontend/dev/vite.config.ts

import { defineConfig } from 'vite';
import tailwindcssVite from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcssVite(),
  ],
  // This 'define' block is the key part for production builds
  define: {
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(process.env.VITE_GOOGLE_CLIENT_ID)
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:3000',
        changeOrigin: true,
      },
      '/ws': {
          target: 'ws://backend:3000',
          ws: true,
      }
    }
  },
});