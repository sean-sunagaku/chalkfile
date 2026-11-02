import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { CourseManifest, CourseStatus } from '../../site/offline-shared';

// 多言語: 言語の切り替え、訳の講座（動画は同じ origin の別のサイト /chalkfile-media-<言語>/）の保存・オフライン再生・Range、
// 字幕を焼き込んだ版がある講座（お笑い版）の保存。site/dist と site/dist-media を build_site.ts --strict で作ってから流す
const evidence = process.env.CHALKFILE_EVIDENCE_DIR ?? '/tmp/chalkfile-pwa-evidence';
mkdirSync(evidence, { recursive: true });
const enManifest = JSON.parse(readFileSync('site/dist/en/pstack-comedy/offline-manifest.json', 'utf8')) as CourseManifest;

test.beforeEach(async ({ request }) => {
  expect((await request.post('/__test/control', { data: {} })).ok()).toBeTruthy();
});

async function status(page: Page, id: string): Promise<CourseStatus | undefined> {
  return page.evaluate(async (id) => {
    const reply = await new Promise<{ courses: CourseStatus[] }>((resolve) => {
      const c = new MessageChannel();
      c.port1.onmessage = (e) => { c.port1.close(); resolve(e.data); };
      navigator.serviceWorker.controller!.postMessage({ protocol: 1, type: 'STATUS', lang: 'en' }, [c.port2]);
    });
    return reply.courses.find((s) => s.id === id);
  }, id);
}
async function playAt(page: Page, at: number) {
  const video = page.locator('video');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  await video.evaluate(async (v: HTMLVideoElement, time) => { v.muted = true; v.currentTime = time; await v.play(); }, at);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(at + 0.2);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.getVideoPlaybackQuality().totalVideoFrames)).toBeGreaterThan(0);
  await video.evaluate((v: HTMLVideoElement) => v.pause());
}
async function ready(page: Page, route: string) {
  await page.goto(route);
  await expect(page.locator('#offlineSave')).toBeEnabled();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

test('言語の切り替え: 一覧と講座のページ・日本語だけの講座への案内・375px', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/chalkfile/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.locator('a.course[href="pstack-comedy/"] .facts')).toContainText('English・中文');
  await page.locator('nav.langs').getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/chalkfile\/en\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#courses-title')).toHaveText('Courses in English');
  // 訳していない講座は「日本語だけ」で、日本語のページへ
  await expect(page.locator('#more-courses a.course[href="../stripe-billing/"]')).toContainText('Japanese');
  await page.locator('a.course[href="pstack-comedy/"]').click();
  await expect(page).toHaveURL(/\/chalkfile\/en\/pstack-comedy\/#P01$/);
  expect(await page.title()).toBe('Laugh & Learn: pstack | Chalkfile');
  await expect(page.locator('#tab-transcript')).toHaveText('Transcript');
  await expect(page.locator('#offlineHeading')).toHaveText('Study offline');
  // 字幕（WebVTT）の言語とプレーヤーの字幕の帯
  expect(await page.locator('video track').evaluate((t: HTMLTrackElement) => [t.srclang, t.label])).toEqual(['en', 'English']);
  await page.locator('nav.langs').getByRole('link', { name: '中文', exact: true }).click();
  await expect(page).toHaveURL(/\/chalkfile\/zh\/pstack-comedy\/#P01$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.locator('#tab-quiz')).toHaveText('小测验');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: path.join(evidence, 'i18n-zh-mobile-375.png'), fullPage: false });
  await page.locator('nav.langs').getByRole('link', { name: '日本語', exact: true }).click();
  await expect(page).toHaveURL(/\/chalkfile\/pstack-comedy\/#P01$/);
  await expect(page.locator('#tab-transcript')).toHaveText('台本');
  expect(errors).toEqual([]);
});

test('英語の講座を保存し、通信なしで動画のサイトの動画を再生・Range・シーク・字幕の切り替えができる', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page, '/chalkfile/en/pstack-comedy/');
  // 字幕オンが既定。字幕を焼き込んだ版を、動画のサイトから流す
  expect(await page.locator('video').evaluate((v: HTMLVideoElement) => v.currentSrc)).toContain('/chalkfile-media-en/pstack-comedy/P01.en.cc.mp4?v=');
  await playAt(page, 30);
  await page.locator('#offlineSave').click();
  await expect(page.locator('#savedState')).toContainText('Saved · course and all videos');
  const saved = (await status(page, 'en/pstack-comedy'))!.saved!;
  expect(saved.manifest.files.map((f) => f.url.split('?')[0])).toEqual(enManifest.files.map((f) => f.url.split('?')[0]));
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#savedState')).toContainText('Saved');
  await expect(page.locator('#networkState')).toContainText('Offline');
  await playAt(page, 120);
  const mp4 = enManifest.files.find((f) => f.url.includes('P01.en.mp4'))!;
  const source = readFileSync('site/dist-media/en/pstack-comedy/P01.en.mp4');
  for (const [range, start, end] of [['bytes=0-127', 0, 127], ['bytes=1000-1127', 1000, 1127], ['bytes=-128', source.length - 128, source.length - 1]] as const) {
    const r = await page.evaluate(async ({ url, range }) => {
      const res = await fetch(new URL(url, location.origin + '/chalkfile/'), { headers: { Range: range } });
      return { status: res.status, bytes: [...new Uint8Array(await res.arrayBuffer())], etag: res.headers.get('ETag') };
    }, { url: mp4.url, range });
    expect(r.status).toBe(206);
    expect(r.etag).toBe(`"${mp4.sha256}"`);
    expect(r.bytes).toEqual([...source.subarray(start, end + 1)]);
  }
  // 字幕オフ（字幕なしの版に差し替える）も、保存版で再生できる
  await page.locator('#ccToggle').click();
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentSrc)).toContain('P01.en.mp4?v=');
  await playAt(page, 60);
  await page.screenshot({ path: path.join(evidence, 'i18n-en-offline-playback.png'), fullPage: false });
  await page.locator('#offlineDelete').click();
  await expect(page.locator('#savedState')).toContainText('Not saved');
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

test('動画のサイトがまだ無くても Service Worker が入る。オフラインで、保存していない訳の動画とポスターには 503 を返す（一覧のページを返さない）', async ({ page, request, context }) => {
  expect((await request.post('/__test/control', { data: { mediaDown: true } })).ok()).toBeTruthy();
  // 起動用ファイルに動画のサイトのファイルが入っていると、install が失敗して worker が入らない
  await ready(page, '/chalkfile/en/pstack-comedy/');
  expect((await request.post('/__test/control', { data: {} })).ok()).toBeTruthy();
  await context.setOffline(true);
  const urls = enManifest.files.map((f) => f.url).filter((u) => u.includes('/chalkfile-media-en/'));
  expect(urls.length).toBeGreaterThan(1);
  const got = await page.evaluate(async (urls) => Promise.all(urls.map(async (url) => {
    const res = await fetch(new URL(url, location.origin + '/chalkfile/'));
    return { status: res.status, html: (res.headers.get('Content-Type') ?? '').includes('text/html') };
  })), urls);
  for (const r of got) expect(r).toEqual({ status: 503, html: false });
  await context.setOffline(false);
});

test('学習の記録（見た位置）は言語ごとに分ける（動画の長さが違うので、日本語の続きから再生しない）', async ({ page }) => {
  await page.goto('/chalkfile/pstack-comedy/');
  await page.evaluate(() => localStorage.setItem('chalkfile:pstack-comedy:progress', JSON.stringify({ P01: { t: 200, max: 0.7, done: false } })));
  await page.goto('/chalkfile/en/pstack-comedy/');
  const video = page.locator('video');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeLessThan(1);
  // 日本語のページは、前と同じ鍵の続きから再生する
  await page.goto('/chalkfile/pstack-comedy/');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(190);
});

test('字幕を焼き込んだ版がある講座（お笑い版）も保存できる', async ({ page }) => {
  await ready(page, '/chalkfile/pstack-comedy/');
  await page.locator('#offlineSave').click();
  await expect(page.locator('#savedState')).toContainText('保存済み・教材と全動画');
  const saved = (await status(page, 'pstack-comedy'))!.saved!;
  expect(saved.manifest.files.map((f) => f.url.split('?')[0])).toEqual(['pstack-comedy/', 'pstack-comedy/media/P01.mp4', 'pstack-comedy/media/P01.jpg', 'pstack-comedy/media/P01.cc.mp4']);
  await page.locator('#offlineDelete').click();
  await expect(page.locator('#savedState')).toContainText('未保存');
});
