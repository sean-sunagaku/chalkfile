// wrangler dev / workers.dev / 本番の同じ静的ルートと SW scope を検証する。
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { COURSES } from '../content';

const base = process.argv[2] ?? 'http://127.0.0.1:8787/';
// 購入直後の端末側 negative DNS cache の検証用。公開DNSで確認したIPだけを明示し、TLS検証は維持する。
const resolveIp = process.env.CHALKFILE_RESOLVE_IP;
if (resolveIp && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(resolveIp)) throw new Error('検証先 IP の形式が不正です');
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true,
  args: resolveIp ? [`--host-resolver-rules=MAP chalkfile.com ${resolveIp}`] : [] });
const context = await browser.newContext();
const page = await context.newPage();
const violations: { directive: string; blocked: string }[] = [];
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await context.exposeFunction('recordCspViolation', (directive: string, blocked: string) => violations.push({ directive, blocked }));
await context.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => {
  void (window as unknown as { recordCspViolation(d: string, b: string): Promise<void> }).recordCspViolation(e.violatedDirective, e.blockedURI.split('?')[0]);
}));
const pages: { path: string; status: number | undefined }[] = [];
try {
  for (const route of ['', ...COURSES.map((c) => `${c.id}/`)]) {
    const response = await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    pages.push({ path: route || '/', status: response?.status() });
    if (response?.status() !== 200 || !await page.locator('h1').isVisible()) throw new Error(`ページを表示できません: ${route}`);
  }
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  if (new URL(scope).pathname !== '/') throw new Error('SW の scope が / ではありません');
  mkdirSync('.work/evidence', { recursive: true });
  writeFileSync('.work/evidence/site-smoke.json', JSON.stringify({ base, resolveIp, pages, scope, violations, errors }, null, 2));
  if (violations.length || errors.length) { console.error({ violations, errors }); throw new Error('CSP またはページのエラーがあります'); }
  console.log(`全 ${pages.length} ページ 200・CSP/JS エラーなし・SW scope /`);
} finally { await browser.close(); }
