import { test, expect, chromium, type Page, type APIRequestContext } from '@playwright/test';
import { existsSync, readFileSync, readdirSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { CourseManifest, CourseStatus } from '../../site/offline-shared';

const route = '/chalkfile/stripe-billing/';
const manifest = JSON.parse(readFileSync('site/dist/stripe-billing/offline-manifest.json', 'utf8')) as CourseManifest;
// 一覧の「講座ごとの保存状態」は、build した講座の数だけ並ぶ。テストは Stripe 講座のリンクを選ぶ
const courseCount = readdirSync('site/dist', { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(path.join('site/dist', d.name, 'offline-manifest.json'))).length;
const savedLink = (page: Page) => page.locator(`#savedCourses a[href$="${route}"]`);
const evidence = process.env.CHALKFILE_EVIDENCE_DIR ?? '/tmp/chalkfile-pwa-evidence';
mkdirSync(evidence, { recursive: true });

async function control(request: APIRequestContext, state: Record<string, unknown> = {}) {
  expect((await request.post('/__test/control', { data: state })).ok()).toBeTruthy();
}
async function ready(page: Page) {
  await page.goto(route);
  await expect(page.locator('#offlineSave')).toBeEnabled();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}
async function save(page: Page) {
  await page.locator('#offlineSave').click();
  await expect(page.locator('#savedState')).toContainText('保存済み・教材と全動画');
  await expect(page.locator('#offlineProgress')).toBeHidden();
}
async function status(page: Page): Promise<CourseStatus> {
  return page.evaluate(async () => {
    const reply = await new Promise<{ courses: CourseStatus[] }>((resolve) => {
      const c = new MessageChannel(); c.port1.onmessage = (e) => { c.port1.close(); resolve(e.data); };
      navigator.serviceWorker.controller!.postMessage({ protocol: 1, type: 'STATUS' }, [c.port2]);
    });
    return reply.courses.find((s) => s.id === 'stripe-billing')!;
  });
}
async function playAndPause(page: Page, at = 0) {
  const video = page.locator('video');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  await video.evaluate(async (v: HTMLVideoElement, time) => { v.muted = true; v.currentTime = time; await v.play(); }, at);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(at + 0.2);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.getVideoPlaybackQuality().totalVideoFrames)).toBeGreaterThan(0);
  await video.evaluate((v: HTMLVideoElement) => v.pause());
  const pausedAt = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await page.waitForTimeout(350);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(pausedAt, 1);
}

test.beforeEach(async ({ request }) => { await control(request); });

test('一覧ページの375px表示から保存状態とインストール案内へ進める', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/chalkfile/');
  await expect(page.locator('#savedCourses a')).toHaveCount(courseCount);
  await expect(page.locator('#offlineMessage')).toContainText('保存状態を確認しました');
  await expect(page.locator('h1')).toHaveText('Chalkfile');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByRole('link', { name: '保存・アプリ', exact: true }).click();
  await expect(page.locator('#offlineHeading')).toBeInViewport();
  await expect(page.locator('#savedCourses')).toContainText('未保存・オンラインで開く');
  await page.locator('#installHelp summary').click();
  await expect(page.locator('#installHelp')).toContainText('ホーム画面に追加');
  await page.screenshot({ path: path.join(evidence, 'home-mobile-375.png'), fullPage: false });
  await savedLink(page).click();
  await expect(page.locator('#offlineSave')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('オンライン再生、単体ファイル保存、学習UI、PWA情報と375pxの導線', async ({ page, context, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await ready(page);
  expect(await page.title()).toContain('Stripe サブスク課金 基礎講座');
  await expect(page.locator('h1')).not.toBeEmpty();
  await expect(page.locator('#playbackStatus')).toContainText('オンライン再生');
  await playAndPause(page, 5);
  expect((await (await request.get('/__test/stats')).json()).fullVideoDownloads).toBe(0);
  const download = page.waitForEvent('download');
  await page.locator('#fileDownload').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('L01.mp4');
  expect(await file.failure()).toBeNull();
  expect((await status(page)).saved).toBeNull();
  await page.getByRole('tab', { name: '台本', exact: true }).click();
  await page.locator('#q').fill('サブスク');
  await expect(page.locator('#transcript')).toContainText('サブスク');
  await page.getByRole('tab', { name: 'ノート', exact: true }).click();
  await page.locator('#noteText').fill('オフライン回帰テストのノート');
  await page.locator('#noteAdd').click();
  await expect(page.locator('#notes')).toContainText('オフライン回帰テストのノート');
  await page.getByRole('tab', { name: '確認クイズ', exact: true }).click();
  await page.locator('.choice').first().click();
  await expect(page.locator('.explain').first()).toBeVisible();
  const cdp = await context.newCDPSession(page);
  const appManifest = await cdp.send('Page.getAppManifest');
  expect(appManifest.errors).toEqual([]);
  const data = JSON.parse(appManifest.data!);
  expect(data.scope).toBe('./'); expect(data.start_url).toBe('./'); expect(data.icons).toHaveLength(2);
  const installability = await cdp.send('Page.getInstallabilityErrors');
  // 通常のテストcontextはシークレット。アプリ自体の不備が無いことを分けて確認する。
  expect(installability.installabilityErrors.map((e) => e.errorId)).toEqual(['in-incognito']);
  await page.locator('#installHelp summary').click();
  await expect(page.locator('#installHelp')).toContainText('ホーム画面に追加');
  await page.locator('details').filter({ has: page.getByText('保存容量と使い方', { exact: true }) }).locator('summary').click();
  await page.locator('#offlinePersist').click();
  await expect(page.locator('#offlineMessage')).toContainText('ブラウザ');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(evidence, 'online-desktop.png'), fullPage: false });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await expect(page.locator('#offlineSave')).toBeVisible();
  await page.screenshot({ path: path.join(evidence, 'mobile-375.png'), fullPage: false });
  expect(errors).toEqual([]);
});

test('全講座を保存し、オフライン起動・再生・Range・シーク・繰り返し・削除を確認する', async ({ page, context }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (e) => runtimeErrors.push(e.message));
  await ready(page);
  // 同一 origin の別アプリの保存を保持する。
  await page.evaluate(async () => { await (await caches.open('neighbor-app')).put('/neighbor/data', new Response('keep')); });
  await page.getByRole('tab', { name: 'ノート', exact: true }).click();
  await page.locator('#noteText').fill('保存を削除しても残すノート');
  await page.locator('#noteAdd').click();
  const notesBefore = await page.evaluate(() => localStorage.getItem('chalkfile:stripe-billing:notes'));
  await save(page);
  const saved = (await status(page)).saved!;
  expect(saved.manifest.files).toHaveLength(27);
  expect(saved.manifest.revision).toBe(manifest.revision);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#savedState')).toContainText('保存済み・教材と全動画');
  await expect(page.locator('#networkState')).toContainText('オフライン');
  await playAndPause(page, 0);
  const mp4 = manifest.files.find((f) => f.url.includes('L01.mp4'))!;
  const source = readFileSync('site/dist/stripe-billing/media/L01.mp4');
  for (const [range, start, end, code] of [
    ['bytes=0-127', 0, 127, 206], ['bytes=1000-1127', 1000, 1127, 206],
    ['bytes=-128', source.length - 128, source.length - 1, 206],
    [`bytes=${source.length - 128}-`, source.length - 128, source.length - 1, 206],
    [`bytes=${source.length}-`, 0, -1, 416], ['bytes=100-20', 0, -1, 416],
    ['bytes=0-1,20-21', 0, source.length - 1, 200],
  ] as const) {
    const response = await page.evaluate(async ({ url, range }) => {
      const r = await fetch(new URL(url, location.origin + '/chalkfile/'), { headers: { Range: range } });
      const bytes = new Uint8Array(await r.arrayBuffer());
      return { status: r.status, length: bytes.length, head: [...bytes.slice(0, 128)], range: r.headers.get('Content-Range'), type: r.headers.get('Content-Type') };
    }, { url: mp4.url, range });
    expect(response.status).toBe(code);
    if (code !== 416) {
      expect(response.length).toBe(end - start + 1);
      expect(response.head).toEqual([...source.subarray(start, Math.min(start + 128, end + 1))]);
      expect(response.type).toBe('video/mp4');
    } else expect(response.range).toBe(`bytes */${source.length}`);
  }
  const head = await page.evaluate(async (url) => {
    const r = await fetch(new URL(url, location.origin + '/chalkfile/'), { method: 'HEAD', headers: { Range: 'bytes=0-20' } });
    return { status: r.status, length: r.headers.get('Content-Length'), bytes: (await r.arrayBuffer()).byteLength };
  }, mp4.url);
  expect(head).toEqual({ status: 200, length: String(source.length), bytes: 0 });
  for (const [etag, code, bytes] of [[`"${mp4.sha256}"`, 206, 128], ['"older-version"', 200, source.length]] as const) {
    const conditional = await page.evaluate(async ({ url, etag }) => {
      const r = await fetch(new URL(url, location.origin + '/chalkfile/'), { headers: { Range: 'bytes=0-127', 'If-Range': etag } });
      return { status: r.status, bytes: (await r.arrayBuffer()).byteLength };
    }, { url: mp4.url, etag });
    expect(conditional).toEqual({ status: code, bytes });
  }
  await playAndPause(page, 90);
  await page.getByRole('button', { name: 'この動画を繰り返す', exact: true }).click();
  await page.locator('video').evaluate(async (v: HTMLVideoElement) => { v.currentTime = v.duration - 0.3; await v.play(); });
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime)).toBeLessThan(5);
  await page.locator('video').evaluate((v: HTMLVideoElement) => v.pause());
  await expect(page.locator('#nextup')).toBeHidden();
  // 別レクチャー・チャプター・字幕も保存ページから動作する。
  await page.locator('.lec[data-i="2"]').click();
  await page.locator('.lec[data-i="0"]').click();
  await page.locator('.lec[data-i="1"]').click();
  await playAndPause(page, 20);
  expect(await page.locator('video').evaluate((v: HTMLVideoElement) => v.currentSrc)).toContain('L02.mp4?v=');
  await page.getByRole('tab', { name: '概要', exact: true }).click();
  await page.locator('#chapters button').nth(1).click();
  await expect(page.locator('#cc')).not.toBeEmpty();
  await page.screenshot({ path: path.join(evidence, 'offline-playback.png'), fullPage: false });
  await page.goto('/chalkfile/');
  await expect(page.locator('#savedCourses')).toContainText('保存済み');
  await savedLink(page).click();
  await expect(page.locator('#savedState')).toContainText('保存済み');
  await page.locator('#offlineDelete').click();
  await expect(page.locator('#savedState')).toContainText('未保存');
  expect(await page.evaluate(() => localStorage.getItem('chalkfile:stripe-billing:notes'))).toBe(notesBefore);
  expect(await page.evaluate(() => caches.has('neighbor-app'))).toBeTruthy();
  const response = await page.reload();
  expect(response!.status()).toBe(503);
  await expect(page.getByRole('heading', { name: 'この教材は保存されていません' })).toBeVisible();
  await page.getByRole('link', { name: 'Chalkfile の講座一覧と保存状態へ' }).click();
  expect(page.url()).toContain('/chalkfile/');
  expect(runtimeErrors).toEqual([]);
});

for (const mode of ['fail', 'partial', 'corrupt', 'truncated', 'redirect']) test(`${mode}：不完全な保存を成功扱いせず、再試行できる`, async ({ page, request }) => {
  await ready(page);
  await control(request, { mode });
  await page.locator('#offlineSave').click();
  await expect(page.locator('#offlineMessage')).toContainText('再試行');
  await expect(page.locator('#offlineProgress')).toBeHidden();
  expect((await status(page)).saved).toBeNull();
  const staging = await page.evaluate(async () => (await caches.keys()).filter((n) => n.includes(':course:stripe-billing:')));
  expect(staging).toEqual([]);
  await control(request);
  await page.locator('#offlineCheck').click();
  await save(page);
});

test('容量不足の保存例外を表示し、未保存として再試行できる', async ({ page, context }) => {
  await ready(page);
  const worker = context.serviceWorkers()[0];
  await worker.evaluate(() => {
    const original = Cache.prototype.put;
    (globalThis as any).originalPut = original;
    Cache.prototype.put = function (input, response) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('.mp4?')) return Promise.reject(new DOMException('容量不足テスト', 'QuotaExceededError'));
      return original.call(this, input, response);
    };
  });
  await page.locator('#offlineSave').click();
  await expect(page.locator('#offlineMessage')).toContainText('空き容量が不足');
  await expect(page.locator('#offlineProgress')).toBeHidden();
  expect((await status(page)).saved).toBeNull();
  await worker.evaluate(() => { Cache.prototype.put = (globalThis as any).originalPut; });
  await save(page);
});

test('キャンセル・別タブからの重複保存を処理し、再試行できる', async ({ page, context, request }) => {
  await ready(page);
  await control(request, { mode: 'delay' });
  await page.locator('#offlineSave').click();
  await expect(page.locator('#offlineMessage')).toContainText('6 / 27');
  const other = await context.newPage();
  await other.goto(route);
  await expect(other.locator('#offlineProgress')).toBeVisible();
  await expect(other.locator('#offlineSave')).toBeDisabled();
  await other.locator('#offlineCancel').click();
  await expect(page.locator('#offlineMessage')).toContainText('キャンセルしました');
  await expect(page.locator('#offlineProgress')).toBeHidden();
  await expect(other.locator('#offlineProgress')).toBeHidden();
  await expect(other.locator('#offlineMessage')).not.toContainText('保存中');
  expect((await status(page)).saved).toBeNull();
  await other.close();
  await control(request);
  await save(page);
});

test('教材更新：旧版の教材と動画を維持し、失敗後に再試行して完全な新版へ切り替える', async ({ page, context, request }) => {
  await ready(page); await save(page);
  const original = (await status(page)).saved!;
  await control(request, { mode: 'fail', update: true });
  await page.reload();
  expect(await page.title()).not.toContain('更新テスト');
  await page.locator('#offlineCheck').click();
  await expect(page.locator('#offlineSave')).toHaveText('新しい版に更新して保存');
  await page.locator('#offlineSave').click();
  await expect(page.locator('#offlineMessage')).toContainText('再試行');
  expect((await status(page)).saved!.manifest.revision).toBe(original.manifest.revision);
  await context.setOffline(true); await page.reload(); await playAndPause(page, 30);
  await context.setOffline(false);
  await control(request, { update: true });
  await page.locator('#offlineCheck').click();
  await page.locator('#offlineSave').click();
  await expect(page.locator('#offlineReload')).toBeVisible();
  expect((await status(page)).saved!.manifest.revision).not.toBe(original.manifest.revision);
  // 更新後も直前の版の MP4 を混ぜずに返せる。
  const oldFile = original.manifest.files.find((f) => f.url.includes('L01.mp4'))!;
  const oldRange = await page.evaluate(async (url) => (await fetch(new URL(url, location.origin + '/chalkfile/'), { headers: { Range: 'bytes=0-127' } })).status, oldFile.url);
  expect(oldRange).toBe(206);
  await page.locator('#offlineReload').click();
  await expect(page).toHaveTitle(/更新テスト/);
  await context.setOffline(true); await page.reload();
  await expect(page).toHaveTitle(/更新テスト/);
  await playAndPause(page, 60);
  expect(await page.evaluate(async () => (await caches.keys()).filter((n) => n.includes(':course:stripe-billing:')).length)).toBe(2);
});

test('保存ファイルの欠損を検出し、保存済み表示と再生を止めて再保存できる', async ({ page, context }) => {
  await ready(page); await save(page);
  const stored = (await status(page)).saved!;
  await page.evaluate(async ({ cache, url }) => { await (await caches.open(cache)).delete(new URL(url, location.origin + '/chalkfile/').href); },
    { cache: stored.cache, url: stored.manifest.files.find((f) => f.url.includes('L02.mp4'))!.url });
  await page.reload();
  await expect(page.locator('#savedState')).toContainText('保存が不完全');
  expect((await status(page)).saved).toBeNull();
  await context.setOffline(true);
  const response = await page.reload();
  expect(response!.status()).toBe(503);
  await expect(page.getByRole('heading', { name: 'この教材は保存されていません' })).toBeVisible();
  await context.setOffline(false); await page.goto(route);
  await expect(page.locator('#offlineSave')).toBeEnabled(); await save(page);
});

test('外部動画を指す教材情報は拒否し、取得しない', async ({ page, request }) => {
  const requests: string[] = [];
  page.context().on('request', (r) => { if (r.url().includes('example.com')) requests.push(r.url()); });
  await ready(page); await control(request, { mode: 'external' });
  await page.locator('#offlineCheck').click();
  await expect(page.locator('#offlineMessage')).toContainText('公開教材だけ');
  await expect(page.locator('#offlineSave')).toBeDisabled();
  expect(requests).toEqual([]);
});

test('ブラウザ完全終了後のオフライン起動とworker更新後にも保存を維持する', async ({ request }) => {
  const profile = mkdtempSync(path.join(tmpdir(), 'chalkfile-pwa-restart-'));
  let context = await chromium.launchPersistentContext(profile, { channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, baseURL: 'http://127.0.0.1:8877' });
  try {
    let page = await context.newPage(); await ready(page);
    const cdp = await context.newCDPSession(page);
    const installability = await cdp.send('Page.getInstallabilityErrors');
    expect(installability.installabilityErrors).toEqual([]);
    await page.locator('#installHelp summary').click();
    await expect(page.locator('#pwaInstall')).toBeVisible();
    await page.screenshot({ path: path.join(evidence, 'install-eligible.png'), fullPage: false });
    await save(page);
    await control(request, { workerUpdate: true });
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
    await expect(page.locator('#appUpdate')).toBeVisible();
    expect((await status(page)).saved).not.toBeNull();
    await context.close();
    context = await chromium.launchPersistentContext(profile, { channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, baseURL: 'http://127.0.0.1:8877' });
    await context.setOffline(true);
    page = await context.newPage(); await page.goto('/chalkfile/');
    await expect(page.locator('#savedCourses')).toContainText('保存済み');
    await savedLink(page).click();
    await expect(page.locator('#savedState')).toContainText('保存済み');
    await playAndPause(page, 90);
  } finally { await context.close(); rmSync(profile, { recursive: true, force: true }); }
});

test('保存中にブラウザを終了しても、途中の講座を保存済みにせず再試行できる', async ({ request }) => {
  const profile = mkdtempSync(path.join(tmpdir(), 'chalkfile-pwa-interrupt-'));
  let context = await chromium.launchPersistentContext(profile, { channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, baseURL: 'http://127.0.0.1:8877' });
  try {
    let page = await context.newPage(); await ready(page);
    await control(request, { mode: 'delay' });
    await page.locator('#offlineSave').click();
    await expect(page.locator('#offlineMessage')).toContainText('6 / 27');
    await context.close();
    await control(request);
    context = await chromium.launchPersistentContext(profile, { channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, baseURL: 'http://127.0.0.1:8877' });
    page = await context.newPage(); await ready(page);
    expect((await status(page)).saved).toBeNull();
    expect(await page.evaluate(async () => (await caches.keys()).filter((n) => n.includes(':course:stripe-billing:')))).toEqual([]);
    await save(page);
  } finally { await context.close(); rmSync(profile, { recursive: true, force: true }); }
});
