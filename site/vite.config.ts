import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const pages = ['index', 'download/index', 'releases/index', 'support/index', 'license/index', 'privacy/index', '404'];
export default defineConfig({
  appType: 'mpa',
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { host: '127.0.0.1', port: 4175, strictPort: true },
  build: {
    outDir: 'dist', emptyOutDir: true,
    rollupOptions: { input: pages.map(page => fileURLToPath(new URL(`${page}.html`, import.meta.url))) },
  },
});
