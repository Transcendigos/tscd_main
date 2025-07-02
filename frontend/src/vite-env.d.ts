/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  // add more VITE_ vars here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}