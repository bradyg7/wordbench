import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// The build a finding was written on (note 50c1): the commit and the day it was built.
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'no-git'; } })();
const BUILD = `${commit} ${new Date().toISOString().slice(0, 10)}`;

// The UI is static files: Tauri loads ui/dist from inside the app; `npm run dev` serves the same on :1420 for Tauri's
// dev mode and for the WebKit tests (which read generated fixtures instead of calling Rust).
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  clearScreen: false,
  define: { __WB_BUILD__: JSON.stringify(BUILD) },
  server: { port: 1420, strictPort: true, host: '127.0.0.1' },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
});
