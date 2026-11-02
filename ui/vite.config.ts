import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// The UI is static files: Tauri loads ui/dist from inside the app; `npm run dev` serves the same on :1420 for Tauri's
// dev mode and for the WebKit tests (which read generated fixtures instead of calling Rust).
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: '127.0.0.1' },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
});
