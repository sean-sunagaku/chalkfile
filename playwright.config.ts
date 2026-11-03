// ブラウザのテスト（Playwright）。テストのサーバー（tests/browser-server.ts）が、テストごとに別の番号で講座サイトを配る。
//   npm run test:e2e:ci     合成の講座（project ci）。本物の講座も動画も要らない（ffmpeg が要る）。CI は PW_CHANNEL=chromium
//   npm run test:e2e:real   本物の講座と、入れてある Chrome（project real。先に npm run build:site -- --strict と、手元の動画）
//   npm run test:e2e        両方
// 番号: テストのサーバーは PW_PORT（既定は 0 = 空いている番号。テストごとのサイトも空いている番号）。作業フォルダが違えば、同時に流せる
// 証跡: CHALKFILE_EVIDENCE_DIR（既定は作業フォルダの .work/evidence/browser）。同じ作業フォルダで同時に流すときは、別の場所にする
// workers: PW_WORKERS（既定は 2）
import path from 'node:path';
import { defineConfig } from '@playwright/test';
import type { SiteMode } from './tests/e2e/site';

process.env.CHALKFILE_EVIDENCE_DIR ??= path.join(__dirname, '.work/evidence/browser');
const evidence = process.env.CHALKFILE_EVIDENCE_DIR;

export default defineConfig<{ siteMode: SiteMode }>({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: Number(process.env.PW_WORKERS ?? 2),
  timeout: 120000,
  expect: { timeout: 20000 },
  outputDir: path.join(evidence, 'test-results'),
  reporter: 'line',
  use: {
    channel: process.env.PW_CHANNEL ?? 'chrome',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    // 多言語のテストは本物の講座の訳を使う。アクセシビリティの検査は、中身の変わらない合成の講座で見る
    { name: 'ci', use: { siteMode: 'ci' }, testIgnore: /i18n\.spec\.ts$/ },
    { name: 'real', use: { siteMode: 'real' }, testIgnore: /a11y\.spec\.ts$/ },
  ],
  webServer: {
    command: 'bun tests/browser-server.ts',
    env: { PW_PORT: process.env.PW_PORT ?? '0' },
    // 「chalkfile-e2e: <URL>」の URL を、テストの側の process.env.CHALKFILE_E2E_HUB にする（tests/browser/fixtures.ts）
    wait: { stdout: /chalkfile-e2e: (?<chalkfile_e2e_hub>http:\/\/127\.0\.0\.1:\d+)\// },
    stdout: 'pipe',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    timeout: 120000,
  },
});
