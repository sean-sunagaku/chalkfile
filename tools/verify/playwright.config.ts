// 手元の Worker と公開サイトで同じ検査を使う。サーバーは呼び出す側が用意する。
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL;
if (!baseURL) throw new Error('BASE_URL を指定する（npm run verify:site -- <URL>）');
const resolveIp = process.env.CHALKFILE_RESOLVE_IP;
if (resolveIp && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(resolveIp)) throw new Error('検証先 IP の形式が不正です');
const evidence = path.resolve(__dirname, '../../.work/evidence');
export default defineConfig({
  testDir: '.',
  testMatch: 'site.smoke.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 180000,
  expect: { timeout: 30000 },
  reporter: 'line',
  outputDir: path.join(evidence, 'site-smoke-results'),
  projects: [{ name: 'smoke' }],
  use: {
    baseURL,
    channel: process.env.PW_CHANNEL ?? 'chrome',
    launchOptions: { args: resolveIp ? [`--host-resolver-rules=MAP ${new URL(baseURL).hostname} ${resolveIp}`] : [] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
