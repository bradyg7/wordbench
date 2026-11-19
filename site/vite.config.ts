import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const pages = ['index', 'download/index', 'releases/index', 'support/index', 'privacy/index'];
export default defineConfig({
  // SITE_BASE=/wordbench-releases/ for GitHub Pages of the releases repository (design/features/site S-1)
  base: process.env.SITE_BASE ?? '/',
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { host: '127.0.0.1', port: 4175, strictPort: true },
  build: {
    outDir: 'dist', emptyOutDir: true,
    rollupOptions: { input: pages.map(page => fileURLToPath(new URL(`${page}.html`, import.meta.url))) },
  },
});
