// 手元の wrangler dev に、配信の約束を HTTP とブラウザで確かめる（本番には向けない）。
// 使い方: bun scripts/smoke_worker.ts [BASE_URL] [--dist site/dist]
// www は Host ヘッダーで試す。wrangler dev は --infer-origin-from-routes=false で起動する（docs/operations/publish.md）。
import config from '../chalkfile.config';
import { chromium } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { headersFor } from './site/headers';

const ROOT = path.resolve(import.meta.dir, '..');
const args = process.argv.slice(2);
const distAt = args.indexOf('--dist');
const positional = args.filter((_, i) => distAt < 0 || (i !== distAt && i !== distAt + 1));
if ((distAt >= 0 && !args[distAt + 1]) || positional.length > 1 || positional.some((a) => a.startsWith('-'))) {
  console.error(
    '使い方: bun scripts/smoke_worker.ts [BASE_URL] [--dist site/dist]（BASE_URL は環境変数でも渡せる。既定は http://127.0.0.1:8787/）',
  );
  process.exit(1);
}
const dist = path.resolve(distAt >= 0 ? args[distAt + 1]! : path.join(ROOT, 'site/dist'));
const base = new URL(positional[0] ?? process.env.BASE_URL ?? 'http://127.0.0.1:8787/');
const WWW = `www.${new URL(config.origin).hostname}`;
// 一覧に無い合成の動画。中継は上流へ出ずに 404 を返す。
const UNKNOWN_MEDIA = `/media/ja/smoke-course/X00.${'0'.repeat(64)}.mp4`;

const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push({ name, ok, detail });
const get = (route: string, init: RequestInit = {}) => fetch(new URL(route, base), { redirect: 'manual', ...init });
const header = (response: Response, name: string) => response.headers.get(name) ?? '';

// 組み立てたサイトの全ページ（index.html のあるフォルダ）。
function pagesOf(dir: string, prefix = '/'): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return [
    ...(entries.some((e) => e.isFile() && e.name === 'index.html') ? [prefix] : []),
    ...entries.filter((e) => e.isDirectory()).flatMap((e) => pagesOf(path.join(dir, e.name), `${prefix}${e.name}/`)),
  ];
}
if (!existsSync(path.join(dist, 'index.html'))) {
  console.error(
    `組み立てたサイトがありません: ${dist}。先に bun scripts/synth.ts --cached-only && bun scripts/build_site.ts --strict`,
  );
  process.exit(1);
}
const pages = pagesOf(dist).sort();

for (const route of pages) {
  const response = await get(route, { headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' } });
  const body = await response.text();
  const cache = header(response, 'Cache-Control');
  check(
    `ページ ${route}`,
    response.status === 200 &&
      header(response, 'Content-Type').startsWith('text/html') &&
      cache.includes('no-transform') &&
      !body.includes('cloudflareinsights'),
    `${response.status} ${cache}`,
  );
}
const sw = await get('/sw.js');
await sw.body?.cancel();
check(
  'SW の配信 /sw.js',
  sw.status === 200 &&
    /javascript/.test(header(sw, 'Content-Type')) &&
    header(sw, 'Cache-Control').includes('no-cache') &&
    header(sw, 'Cache-Control').includes('no-transform'),
  `${sw.status} ${header(sw, 'Cache-Control')}`,
);
// 静的な応答のヘッダーが、_headers の規則（scripts/site/headers.ts）のとおり（セキュリティのヘッダー・no-transform。
// 同じパスに 2 つの規則が当たって、値がカンマでつながっていない）。?v= の付いた資源（最初の講座のポスター）は immutable
{
  const differ: string[] = [];
  const course = pages.find((p) => p !== '/' && existsSync(path.join(dist, p, 'media')));
  const poster = course ? readdirSync(path.join(dist, course, 'media')).find((f) => f.endsWith('.jpg')) : undefined;
  const routes = ['/', '/sw.js', '/robots.txt', '/sitemap.xml', ...(course && poster ? [`${course}media/${poster}?v=smoke`] : [])];
  for (const route of routes) {
    const response = await get(route, { headers: { 'Sec-Fetch-Mode': route === '/' ? 'navigate' : 'no-cors' } });
    await response.body?.cancel();
    for (const [name, value] of headersFor(new URL(route, base).pathname).headers) {
      if (header(response, name) !== value) differ.push(`${route} ${name}: ${header(response, name) || '(無い)'}`);
    }
  }
  check('静的な応答のヘッダー（_headers の規則のとおり）', !differ.length, differ.join(' / '));
}
for (const mode of ['navigate', 'no-cors']) {
  const missing = await get('/__smoke__/missing/', { headers: { 'Sec-Fetch-Mode': mode } });
  await missing.body?.cancel();
  check(
    `知らないページ（${mode}）は 404`,
    missing.status === 404 && header(missing, 'Cache-Control').includes('no-transform'),
    `${missing.status}`,
  );
}
const media = await get(UNKNOWN_MEDIA);
check(
  '知らない /media/ は 404',
  media.status === 404 &&
    header(media, 'Cache-Control') === 'no-store' &&
    header(media, 'X-Content-Type-Options') === 'nosniff' &&
    header(media, 'Cross-Origin-Resource-Policy') === 'same-origin' &&
    (await media.text()) === '動画が見つかりません。',
  `${media.status} ${header(media, 'Cache-Control')} CORP=${header(media, 'Cross-Origin-Resource-Policy')}`,
);
const post = await get(UNKNOWN_MEDIA, { method: 'POST' });
await post.body?.cancel();
check(
  '/media/ への POST は 405',
  post.status === 405 && header(post, 'Allow') === 'GET, HEAD',
  `${post.status} Allow=${header(post, 'Allow')}`,
);
const www = await get(`${UNKNOWN_MEDIA}?download=1`, { headers: { Host: WWW } });
await www.body?.cancel();
check(
  'www の /media/ は apex へ 301',
  www.status === 301 && header(www, 'Location') === `${new URL(config.origin).origin}${UNKNOWN_MEDIA}?download=1`,
  `${www.status} ${header(www, 'Location')}${www.status === 404 ? '（wrangler dev を --infer-origin-from-routes=false で起動したか確かめる）' : ''}`,
);
const wwwPage = await get('/', { headers: { Host: WWW, Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' } });
await wwwPage.body?.cancel();
check(
  'www の HTML は assets が 200 で返す',
  wwwPage.status === 200 && header(wwwPage, 'Content-Type').startsWith('text/html'),
  `${wwwPage.status}`,
);

// SW の scope と CSP は、ブラウザで開いて確かめる（PW_CHANNEL で chromium などに変えられる）。
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`JS: ${e.message}`));
  await context.exposeFunction('recordCspViolation', (directive: string, blocked: string) => {
    problems.push(`CSP: ${directive} ${blocked}`);
  });
  await context.addInitScript(() =>
    document.addEventListener('securitypolicyviolation', (e) => {
      void (window as unknown as { recordCspViolation(d: string, b: string): Promise<void> }).recordCspViolation(
        e.violatedDirective,
        e.blockedURI.split('?')[0],
      );
    }),
  );
  for (const route of pages) {
    const response = await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    check(
      `ブラウザで表示 ${route}`,
      response?.status() === 200 && (await page.locator('h1').first().isVisible()),
      `${response?.status()}`,
    );
  }
  await page.goto(base.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 60000 });
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  check('SW の scope は /', new URL(scope).pathname === '/', scope);
  check('CSP の違反とページのエラーが 0', !problems.length, problems.join(' / '));
} finally {
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? 'ok ' : 'NG '} ${r.name}${r.ok ? '' : `: ${r.detail}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed
    ? `smoke: ${failed} 件が失敗（${results.length} 件中）`
    : `smoke: ${results.length} 件すべて通過（${base.origin}・${pages.length} ページ）`,
);
if (failed) process.exit(1);
