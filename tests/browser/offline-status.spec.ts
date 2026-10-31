import { test, expect, chromium, type Page, type APIRequestContext } from '@playwright/test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { CourseStatus } from '../../site/offline-shared';

const course = '/chalkfile/stripe-billing/';
const evidence = '/tmp/chalkfile-pwa-evidence/offline-status';

async function control(request: APIRequestContext, data: Record<string, unknown> = {}) {
  expect((await request.post('/__test/control', { data })).ok()).toBeTruthy();
}
async function state(page: Page): Promise<CourseStatus> {
  return page.evaluate(() => new Promise((resolve) => {
    const c = new MessageChannel();
    c.port1.onmessage = (e) => { c.port1.close(); resolve(e.data.courses.find((s: CourseStatus) => s.id === 'stripe-billing')); };
    navigator.serviceWorker.controller!.postMessage({ protocol: 1, type: 'STATUS' }, [c.port2]);
  }));
}
async function refresh(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  // 実 worker の状態確認と容量表示が完了する時間を置き、案内文が保たれることを観測する。
  await page.waitForTimeout(300);
}

test('保存状態の初期案内と進捗・エラーの保護', async ({ request }, testInfo) => {
  test.setTimeout(240000);
  await control(request);
  mkdirSync(evidence, { recursive: true });
  const profile = mkdtempSync(path.join(tmpdir(), 'chalkfile-offline-status-'));
  const options = { channel: process.env.PW_CHANNEL ?? 'chrome', headless: true,
    baseURL: 'http://127.0.0.1:8877', viewport: { width: 1440, height: 1000 } };
  let context = await chromium.launchPersistentContext(profile, options);
  const browser = context.browser()!.version();
  const observations: { name: string; message: string | null }[] = [];
  const errors: string[] = [];
  const observe = (page: Page) => page.on('pageerror', (e) => errors.push(e.message));
  const record = async (page: Page, name: string) => { observations.push({ name, message: await page.locator('#offlineMessage').textContent() }); };
  let passed = false;
  let completeDownloads = 0;
  let incompleteStateInjected = false;
  try {
    let page = await context.newPage(); observe(page);
    await test.step('未保存のオンライン・通信断と、通信エラーを状態確認で上書きしない', async () => {
      await page.goto(course);
      await expect(page.locator('#offlineSave')).toBeEnabled();
      await expect(page.locator('#offlineMessage')).toContainText('この講座は未保存');
      await context.setOffline(true); await refresh(page);
      await expect(page.locator('#offlineMessage')).toContainText('通信が必要');
      await record(page, '未保存・オフライン');
      await context.setOffline(false);
      await expect(page.locator('#offlineCheck')).toBeEnabled();
      await control(request, { manifestMode: 'fail' });
      await page.locator('#offlineCheck').click();
      await expect(page.locator('#offlineMessage')).toContainText('教材情報を取得できません');
      const error = await page.locator('#offlineMessage').textContent();
      await refresh(page);
      await expect(page.locator('#offlineMessage')).toHaveText(error!);
      await context.setOffline(true); await refresh(page);
      await expect(page.locator('#offlineMessage')).toHaveText(error!);
      await record(page, '通信エラーを保持');
      await page.screenshot({ path: path.join(evidence, 'communication-error.png') });
      await control(request);
      await context.setOffline(false);
      await expect(page.locator('#networkState')).toContainText('オンライン');
      await expect(page.locator('#offlineCheck')).toBeEnabled();
      await page.locator('#offlineCheck').click();
      await expect(page.locator('#offlineSave')).toBeEnabled();
    });
    await test.step('遅れて返る確認エラーと、同時の状態確認から保存進捗を守る', async () => {
      await control(request, { mode: 'delay', manifestMode: 'delay-first-fail' });
      await page.locator('#offlineCheck').click();
      await page.locator('#offlineSave').click();
      await expect(page.locator('#offlineMessage')).toContainText('6 / 27');
      await expect.poll(async () => (await (await request.get('/__test/stats')).json()).manifestFailures).toBe(1);
      await refresh(page);
      await expect(page.locator('#offlineMessage')).toContainText('保存中');
      await expect(page.locator('#offlineProgress')).toBeVisible();
      await record(page, '遅い確認エラー後も保存進捗を保持');
      await page.screenshot({ path: path.join(evidence, 'saving-progress.png') });
      const other = await context.newPage(); observe(other);
      await other.goto(course);
      await expect(other.locator('#offlineMessage')).toContainText('保存中');
      await refresh(other);
      await expect(other.locator('#offlineMessage')).toContainText('保存中');
      await other.close();
      await expect(page.locator('#savedState')).toContainText('保存済み・教材と全動画');
      await expect(page.locator('#offlineProgress')).toBeHidden();
      await expect(page.locator('#offlineMessage')).toContainText('保存が完了しました');
      const completed = await page.locator('#offlineMessage').textContent();
      await refresh(page);
      await expect(page.locator('#offlineMessage')).toHaveText(completed!);
      expect((await state(page)).saved!.manifest.files).toHaveLength(27);
      completeDownloads++;
      await control(request);
    });
    await test.step('完全終了後にオフラインで起動し、保存済みの案内と実動画を確認', async () => {
      await context.close();
      context = await chromium.launchPersistentContext(profile, { ...options, offline: true });
      page = await context.newPage(); observe(page);
      const response = await page.goto('/chalkfile/');
      expect(response!.fromServiceWorker()).toBeTruthy();
      await expect(page.locator('#offlineMessage')).toContainText('保存状態を確認しました');
      await page.locator('#savedCourses a').click();
      await expect(page.locator('#offlineMessage')).toContainText('保存済みの教材と全動画を利用できます');
      await expect(page.locator('#networkState')).toContainText('オフライン');
      await refresh(page);
      await expect(page.locator('#offlineMessage')).not.toContainText('準備しています');
      await page.locator('video').evaluate(async (v: HTMLVideoElement) => { v.muted = true; v.currentTime = 20; await v.play(); });
      await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(20.2);
      expect(await page.locator('video').evaluate((v: HTMLVideoElement) => v.getVideoPlaybackQuality().totalVideoFrames)).toBeGreaterThan(0);
      await page.locator('video').evaluate((v: HTMLVideoElement) => v.pause());
      await page.evaluate(() => scrollTo(0, 0));
      await record(page, '完全再起動・オフラインの保存済み案内');
      await page.screenshot({ path: path.join(evidence, 'saved-offline-restart.png') });
    });
    await test.step('一部欠損でも旧完全版が使える状態を、再起動後に正しく案内', async () => {
      // 追加の全動画取得を避け、最新保存領域の消去に相当する状態を Cache API で注入する。
      await page.evaluate(async () => {
        const name = (await caches.keys()).find((n) => n.endsWith(':registry'))!;
        const registry = await caches.open(name);
        const key = (await registry.keys()).find((r) => r.url.endsWith('/stripe-billing'))!;
        const record = await (await registry.match(key))!.json();
        record.versions.unshift({ ...record.versions[0], cache: record.versions[0].cache + ':missing' });
        await registry.put(key, Response.json(record));
      });
      incompleteStateInjected = true;
      await context.close();
      context = await chromium.launchPersistentContext(profile, { ...options, offline: true });
      page = await context.newPage(); observe(page);
      await page.goto(course);
      await expect(page.locator('#offlineMessage')).toContainText('一部の保存が不完全');
      await expect(page.locator('#offlineMessage')).toContainText('前の完全な保存版を利用できます');
      expect((await state(page)).incomplete).toBeTruthy();
      await record(page, '完全再起動・不完全だが旧版あり');
      await page.screenshot({ path: path.join(evidence, 'incomplete-with-previous.png') });
    });
    await test.step('完全版が残っていない欠損と、削除後の未保存を案内', async () => {
      const saved = (await state(page)).saved!;
      await page.evaluate(async (name) => { await caches.delete(name); }, saved.cache);
      await context.setOffline(false);
      await page.reload();
      await expect(page.locator('#savedState')).toContainText('保存が不完全');
      await expect(page.locator('#offlineMessage')).toHaveText('保存が不完全です。オンラインで保存し直してください。');
      await expect(page.locator('#offlineCheck')).toBeEnabled();
      await page.locator('#offlineCheck').click();
      await expect(page.locator('#offlineMessage')).toHaveText('保存が不完全です。オンラインで保存し直してください。');
      await record(page, '完全版のない不完全な保存');
      await page.locator('#offlineDelete').click();
      await expect(page.locator('#offlineMessage')).toContainText('削除しました');
      await refresh(page);
      await expect(page.locator('#offlineMessage')).toContainText('削除しました');
      await page.reload();
      await expect(page.locator('#offlineMessage')).toContainText('この講座は未保存');
      await record(page, '削除後の未保存');
    });
    expect(errors).toEqual([]);
    passed = true;
  } finally {
    await context.close(); rmSync(profile, { recursive: true, force: true });
    const result = { passed, browser, observations, pageErrors: errors,
      sourceManifestRevision: JSON.parse(readFileSync('site/dist/stripe-billing/offline-manifest.json', 'utf8')).revision,
      completeDownloads, incompleteState: incompleteStateInjected ? 'CacheStorage参照先の欠損を注入' : '未実施', publicSiteTested: false };
    writeFileSync(path.join(evidence, 'result.json'), JSON.stringify(result, null, 2));
    await testInfo.attach('保存状態の回帰証跡', { body: Buffer.from(JSON.stringify(result, null, 2)), contentType: 'application/json' });
  }
});

test('375pxで未保存の案内がはみ出さない', async ({ page, request }) => {
  await control(request);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(course);
  await expect(page.locator('#offlineMessage')).toContainText('この講座は未保存');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: path.join(evidence, 'unsaved-mobile-375.png') });
});
