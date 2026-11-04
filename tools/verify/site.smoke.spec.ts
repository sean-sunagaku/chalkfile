// BASE_URL の公開ページを読み、画面の準備・CSP・SW の scope を確かめる。動画の保存はしない。
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { COURSES } from '../../content';

test('全ページの表示・CSP・SW scope', async ({ page, context, baseURL }, testInfo) => {
  const violations: { directive: string; blocked: string }[] = [];
  const errors: string[] = [];
  const pages: { path: string; status: number | undefined; cacheControl: string | undefined; transformed: boolean | undefined }[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.exposeFunction('recordCspViolation', (directive: string, blocked: string) =>
    violations.push({ directive, blocked }),
  );
  await context.addInitScript(() =>
    document.addEventListener('securitypolicyviolation', (event) => {
      void (window as unknown as { recordCspViolation(d: string, b: string): Promise<void> }).recordCspViolation(
        event.violatedDirective,
        event.blockedURI.split('?')[0]!,
      );
    }),
  );
  let scope: string | undefined;
  try {
    for (const route of ['', ...COURSES.map((course) => `${course.id}/`), 'offline.html']) {
      const response = await page.goto(new URL(route, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
      pages.push({
        path: route || '/',
        status: response?.status(),
        cacheControl: response?.headers()['cache-control'],
        transformed: (await response?.text())?.includes('static.cloudflareinsights.com/beacon'),
      });
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('h1').first()).toBeVisible();
      // SSR の見出しだけで終えず、講座の JS が台本の操作ボタンを作るまで待つ（タブは閉じたまま）。
      if (route.endsWith('/')) await expect(page.locator('#transcript button[data-t]').first()).toBeAttached();
    }
    await page.goto(baseURL!, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(new URL(scope).pathname).toBe('/');
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
    console.log(`全 ${pages.length} ページ 200・CSP/JS エラーなし・SW scope /`);
  } finally {
    const receipt = JSON.stringify(
      { base: baseURL, resolveIp: process.env.CHALKFILE_RESOLVE_IP, pages, scope, violations, errors },
      null,
      2,
    );
    const evidence = path.resolve(__dirname, '../../.work/evidence');
    mkdirSync(evidence, { recursive: true });
    writeFileSync(path.join(evidence, 'site-smoke.json'), receipt);
    await testInfo.attach('site-smoke', { body: receipt, contentType: 'application/json' });
  }
});
