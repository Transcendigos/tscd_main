// my-vite-tailwind-ts-project/vite.config.ts
import { defineConfig } from 'vite';
import tailwindcssVite from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcssVite(),
  ],
  server: {
    // This ensures Vite listens on 0.0.0.0 inside the container
    // and is accessible from your host machine.
    host: '0.0.0.0',
    port: 5173, // Default Vite port
    
  },
  
});

console.log("ENV DEBUG:", process.env.VITE_GOOGLE_CLIENT_ID);