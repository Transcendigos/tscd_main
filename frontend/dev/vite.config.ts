// my-vite-tailwind-ts-project/vite.config.ts
import { defineConfig } from 'vite';
import tailwindcssVite from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcssVite(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:3000',
        changeOrigin: true,
      }
    }
  },
});

console.log("ENV DEBUG:", process.env.VITE_GOOGLE_CLIENT_ID);