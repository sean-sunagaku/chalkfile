import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: 120000,
  expect: { timeout: 20000 },
  outputDir: process.env.CHALKFILE_EVIDENCE_DIR ?? '/tmp/chalkfile-pwa-evidence/test-results',
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:8877', channel: process.env.PW_CHANNEL ?? 'chrome',
    viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'bun tests/browser-server.ts', url: 'http://127.0.0.1:8877/__test/health', reuseExistingServer: false },
});
