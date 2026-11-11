import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', outputDir: '../test-results/site', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4176', channel: process.platform === 'win32' ? 'msedge' : undefined },
  webServer: { command: 'npm run site:build && npm exec vite -- preview --config site/vite.config.ts --host 127.0.0.1 --port 4176 --strictPort', url: 'http://127.0.0.1:4176', reuseExistingServer: false, cwd: '..' },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
    { name: 'phone', use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } },
  ],
});
