import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './setup-tests', outputDir: '../test-results/setup', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4177', browserName: 'chromium', channel: process.platform === 'win32' ? 'msedge' : undefined },
  webServer: { command: 'npm run dev -- --port 4177', url: 'http://127.0.0.1:4177/setup.html', reuseExistingServer: false, cwd: '..' },
});
