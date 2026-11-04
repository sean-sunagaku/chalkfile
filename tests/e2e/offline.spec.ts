import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type APIRequestContext, chromium, type Page } from '@playwright/test';
import type { CourseStatus } from '../../site/offline-shared';
import { required } from '../support/required';
import { channel, delayedProgress, evidenceDir, expect, manifestOf, seek, test, waitForSaved } from './fixtures';
import type { Stats } from './session';
import { type Control, type SiteSession, UPDATE_NEWS } from './site';

// 保存と再生を確かめる講座は、テストのサーバーのセッションが決める（ci は合成の講座、real は Stripe 講座。tests/e2e/sites.ts）
/** 一覧の「講座ごとの保存状態」は、組み立てた講座の数だけ並ぶ */
const courseCount = (site: SiteSession) =>
  readdirSync(site.dist, { withFileTypes: true }).filter(
    (d) => d.isDirectory() && existsSync(path.join(site.dist, d.name, 'offline-manifest.json')),
  ).length;
const savedLink = (page: Page, site: SiteSession) => page.locator(`#savedCourses a[href$="${site.course.route}"]`);
const evidence = () => {
  const dir = evidenceDir();
  mkdirSync(dir, { recursive: true });
  return dir;
};

async function control(request: APIRequestContext, state: Partial<Control> = {}) {
  expect((await request.post('/__test/control', { data: state })).ok()).toBeTruthy();
}
/** テストのサーバーが数えた取得（保存の動画の全体の取得の回数とバイト数など。control で 0 に戻る） */
async function stats(request: APIRequestContext): Promise<Stats> {
  return (await (await request.get('/__test/stats')).json()) as Stats;
}
async function ready(page: Page, site: SiteSession) {
  await page.goto(site.course.route);
  await expect(page.locator('#offlineSave')).toBeEnabled();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}
async function save(page: Page) {
  await page.locator('#offlineSave').click();
  await waitForSaved(page);
  await expect(page.locator('#offlineProgress')).toBeHidden();
}
async function status(page: Page, site: SiteSession): Promise<CourseStatus> {
  return page.evaluate(async (id) => {
    const reply = await new Promise<{ courses: CourseStatus[] }>((resolve) => {
      const c = new MessageChannel();
      c.port1.onmessage = (e) => {
        c.port1.close();
        resolve(e.data);
      };
      navigator.serviceWorker.controller!.postMessage({ protocol: 1, type: 'STATUS' }, [c.port2]);
    });
    return reply.courses.find((s) => s.id === id)!;
  }, site.course.id);
}
/** 再生してから時刻へ移る（動画は preload="none" で、再生を押すまで読まない） */
async function playAndPause(page: Page, at = 0) {
  const video = page.locator('video');
  await video.evaluate(async (v: HTMLVideoElement, time) => {
    v.muted = true;
    await v.play();
    v.currentTime = time;
  }, at);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(at + 0.2);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.getVideoPlaybackQuality().totalVideoFrames))
    .toBeGreaterThan(0);
  await video.evaluate((v: HTMLVideoElement) => v.pause());
  const pausedAt = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await page.waitForTimeout(350);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(pausedAt, 1);
}

test.beforeEach(async ({ request }) => {
  await control(request);
});

test('一覧ページの375px表示から保存状態とインストール案内へ進める', async ({ page, site }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator('#savedCourses a')).toHaveCount(courseCount(site));
  await expect(page.locator('#offlineMessage')).toContainText('保存状態を確認しました');
  await expect(page.locator('h1')).toHaveText('Chalkfile');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByRole('link', { name: '保存・アプリ', exact: true }).click();
  await expect(page.locator('#offlineHeading')).toBeInViewport();
  await expect(page.locator('#savedCourses')).toContainText('未保存・オンラインで開く');
  await page.locator('#installHelp summary').click();
  await expect(page.locator('#installHelp')).toContainText('ホーム画面に追加');
  await page.screenshot({ path: path.join(evidence(), 'home-mobile-375.png'), fullPage: false });
  await savedLink(page, site).click();
  await expect(page.locator('#offlineSave')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('講座を開いただけでは、動画（/media/）を取りに行かない。長さは台本のデータから出し、再生を押すと開いたレクチャーの動画だけを取る', async ({
  page,
  request,
  site,
}) => {
  await ready(page, site);
  await expect(page.locator('#playbackStatus')).toContainText('オンライン再生');
  // 保存の状態の確かめ・ポスター・字幕のデータの間に、動画を取りに行っていない（preload="none"）
  await page.waitForTimeout(1500);
  expect((await stats(request)).mediaRequests).toBe(0);
  expect(await page.locator('video').evaluate((v: HTMLVideoElement) => [v.preload, v.readyState])).toEqual(['none', 0]);
  await expect(page.locator('#sections .dur').first()).not.toHaveText('00:00');
  await expect(page.locator('#curSum')).not.toBeEmpty();
  await playAndPause(page, seek(site, 5));
  expect((await stats(request)).mediaRequests).toBeGreaterThan(0);
  expect(await page.locator('video').evaluate((v: HTMLVideoElement) => new URL(v.currentSrc).pathname)).toMatch(
    new RegExp(`/${required(site.course.lectures[0]).id}(\\.cc)?\\.[a-f0-9]{64}\\.mp4$`),
  );
});

test('オンライン再生、単体ファイル保存、学習UI、PWA情報と375pxの導線', async ({ page, context, request, site }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await ready(page, site);
  expect(await page.title()).toContain(site.course.title);
  await expect(page.locator('h1')).not.toBeEmpty();
  await expect(page.locator('#playbackStatus')).toContainText('オンライン再生');
  await playAndPause(page, seek(site, 5));
  expect((await (await request.get('/__test/stats')).json()).fullVideoDownloads).toBe(0);
  const download = page.waitForEvent('download');
  await page.locator('#fileDownload').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`${required(site.course.lectures[0]).id}.mp4`);
  expect(await file.failure()).toBeNull();
  expect((await status(page, site)).saved).toBeNull();
  await page.getByRole('tab', { name: '台本', exact: true }).click();
  await page.locator('#q').fill(site.course.searchTerm);
  await expect(page.locator('#transcript')).toContainText(site.course.searchTerm);
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
  expect(data.scope).toBe('./');
  expect(data.start_url).toBe('./');
  expect(data.lang).toBe('ja');
  // ふつうのアイコンと、形を切り抜くアイコン（maskable）は別の画像
  expect((data.icons as { src: string; purpose: string }[]).map((i) => `${i.purpose} ${i.src}`)).toEqual([
    'any icons/icon-192.png',
    'any icons/icon-512.png',
    'maskable icons/maskable-192.png',
    'maskable icons/maskable-512.png',
  ]);
  const installability = await cdp.send('Page.getInstallabilityErrors');
  // 通常のテストcontextはシークレット。アプリ自体の不備が無いことを分けて確認する。
  expect(installability.installabilityErrors.map((e) => e.errorId)).toEqual(['in-incognito']);
  await page.locator('#installHelp summary').click();
  await expect(page.locator('#installHelp')).toContainText('ホーム画面に追加');
  await page
    .locator('details')
    .filter({ has: page.getByText('保存容量と使い方', { exact: true }) })
    .locator('summary')
    .click();
  await page.locator('#offlinePersist').click();
  await expect(page.locator('#offlineMessage')).toContainText('ブラウザ');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(evidence(), 'online-desktop.png'), fullPage: false });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await expect(page.locator('#offlineSave')).toBeVisible();
  await page.screenshot({ path: path.join(evidence(), 'mobile-375.png'), fullPage: false });
  expect(errors).toEqual([]);
});

test('全講座を保存し、オフライン起動・再生・Range・シーク・繰り返し・削除を確認する', async ({
  page,
  context,
  site,
}) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (e) => runtimeErrors.push(e.message));
  const manifest = manifestOf(site);
  const first = required(site.course.lectures[0]);
  const second = required(site.course.lectures[1]);
  const notesKey = `chalkfile:${site.course.id}:notes`;
  await ready(page, site);
  // 同一 origin の別アプリの保存を保持する。
  await page.evaluate(async () => {
    await (await caches.open('neighbor-app')).put('/neighbor/data', new Response('keep'));
  });
  await page.getByRole('tab', { name: 'ノート', exact: true }).click();
  await page.locator('#noteText').fill('保存を削除しても残すノート');
  await page.locator('#noteAdd').click();
  const notesBefore = await page.evaluate((key) => localStorage.getItem(key), notesKey);
  await save(page);
  const saved = (await status(page, site)).saved!;
  expect(saved.manifest.files).toHaveLength(manifest.files.length);
  expect(saved.manifest.revision).toBe(manifest.revision);
  await context.setOffline(true);
  await page.reload();
  await waitForSaved(page);
  await expect(page.locator('#networkState')).toContainText('オフライン');
  await playAndPause(page, 0);
  const mp4 = manifest.files.find((f) => f.url.includes(`/${first.id}.`))!;
  const source = readFileSync(first.video);
  for (const [range, start, end, code] of [
    ['bytes=0-127', 0, 127, 206],
    ['bytes=1000-1127', 1000, 1127, 206],
    ['bytes=-128', source.length - 128, source.length - 1, 206],
    [`bytes=${source.length - 128}-`, source.length - 128, source.length - 1, 206],
    [`bytes=${source.length}-`, 0, -1, 416],
    ['bytes=100-20', 0, -1, 416],
    ['bytes=0-1,20-21', 0, source.length - 1, 200],
  ] as const) {
    const response = await page.evaluate(
      async ({ url, range }) => {
        const r = await fetch(new URL(url, location.origin + '/'), { headers: { Range: range } });
        const bytes = new Uint8Array(await r.arrayBuffer());
        return {
          status: r.status,
          length: bytes.length,
          head: [...bytes.slice(0, 128)],
          range: r.headers.get('Content-Range'),
          type: r.headers.get('Content-Type'),
        };
      },
      { url: mp4.url, range },
    );
    expect(response.status).toBe(code);
    if (code !== 416) {
      expect(response.length).toBe(end - start + 1);
      expect(response.head).toEqual([...source.subarray(start, Math.min(start + 128, end + 1))]);
      expect(response.type).toBe('video/mp4');
    } else expect(response.range).toBe(`bytes */${source.length}`);
  }
  const head = await page.evaluate(async (url) => {
    const r = await fetch(new URL(url, location.origin + '/'), { method: 'HEAD', headers: { Range: 'bytes=0-20' } });
    return { status: r.status, length: r.headers.get('Content-Length'), bytes: (await r.arrayBuffer()).byteLength };
  }, mp4.url);
  expect(head).toEqual({ status: 200, length: String(source.length), bytes: 0 });
  for (const [etag, code, bytes] of [
    [`"${mp4.sha256}"`, 206, 128],
    ['"older-version"', 200, source.length],
  ] as const) {
    const conditional = await page.evaluate(
      async ({ url, etag }) => {
        const r = await fetch(new URL(url, location.origin + '/'), {
          headers: { Range: 'bytes=0-127', 'If-Range': etag },
        });
        return { status: r.status, bytes: (await r.arrayBuffer()).byteLength };
      },
      { url: mp4.url, etag },
    );
    expect(conditional).toEqual({ status: code, bytes });
  }
  await playAndPause(page, seek(site, 90));
  await page.getByRole('button', { name: 'この動画を繰り返す', exact: true }).click();
  const loopFrom = await page.locator('video').evaluate(async (v: HTMLVideoElement) => {
    v.currentTime = v.duration - 0.3;
    await v.play();
    return v.duration - 0.3;
  });
  // 終わりの手前から再生し、頭に戻るのを見る（短い動画では、戻る前の時刻より前になったら戻ったとみなす）
  await expect
    .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeLessThan(Math.min(5, loopFrom));
  await page.locator('video').evaluate((v: HTMLVideoElement) => v.pause());
  await expect(page.locator('#nextup')).toBeHidden();
  // 別レクチャー・チャプター・字幕も保存ページから動作する。
  await page.locator(`.lec[data-i="${Math.min(2, site.course.lectures.length - 1)}"]`).click();
  await page.locator('.lec[data-i="0"]').click();
  await page.locator('.lec[data-i="1"]').click();
  await playAndPause(page, seek(site, 20));
  expect(await page.locator('video').evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(
    new RegExp(`${second.id}\\.[a-f0-9]{64}\\.mp4$`),
  );
  await page.getByRole('tab', { name: '概要', exact: true }).click();
  await page.locator('#chapters button').nth(1).click();
  await expect(page.locator('#cc')).not.toBeEmpty();
  await page.screenshot({ path: path.join(evidence(), 'offline-playback.png'), fullPage: false });
  await page.goto('/');
  await expect(page.locator('#savedCourses')).toContainText('保存済み');
  await savedLink(page, site).click();
  await expect(page.locator('#savedState')).toContainText('保存済み');
  await page.locator('#offlineDelete').click();
  await expect(page.locator('#savedState')).toContainText('未保存');
  expect(await page.evaluate((key) => localStorage.getItem(key), notesKey)).toBe(notesBefore);
  expect(await page.evaluate(() => caches.has('neighbor-app'))).toBeTruthy();
  const response = await page.reload();
  expect(response!.status()).toBe(503);
  await expect(page.getByRole('heading', { name: 'この教材は保存されていません' })).toBeVisible();
  await page.getByRole('link', { name: 'Chalkfile の講座一覧と保存状態へ' }).click();
  expect(page.url()).toContain('/');
  expect(runtimeErrors).toEqual([]);
});

for (const mode of ['fail', 'partial', 'corrupt', 'truncated', 'redirect'] as const)
  test(`${mode}：不完全な保存を成功扱いせず、再試行できる`, async ({ page, request, site }) => {
    await ready(page, site);
    await control(request, { mode });
    await page.locator('#offlineSave').click();
    await expect(page.locator('#offlineMessage')).toContainText('再試行');
    await expect(page.locator('#offlineProgress')).toBeHidden();
    expect((await status(page, site)).saved).toBeNull();
    const staging = await page.evaluate(
      async (id) => (await caches.keys()).filter((n) => n.includes(`:course:${id}:`)),
      site.course.id,
    );
    expect(staging).toEqual([]);
    await control(request);
    await page.locator('#offlineCheck').click();
    await save(page);
  });

test('容量不足の保存例外を表示し、未保存として再試行できる', async ({ page, context, site }) => {
  await ready(page, site);
  const worker = required(context.serviceWorkers()[0]);
  await worker.evaluate(() => {
    const original = Cache.prototype.put;
    (globalThis as any).originalPut = original;
    Cache.prototype.put = function (input, response) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/media/') && url.split('?')[0]!.endsWith('.mp4'))
        return Promise.reject(new DOMException('容量不足テスト', 'QuotaExceededError'));
      return original.call(this, input, response);
    };
  });
  await page.locator('#offlineSave').click();
  await expect(page.locator('#offlineMessage')).toContainText('空き容量が不足');
  await expect(page.locator('#offlineProgress')).toBeHidden();
  expect((await status(page, site)).saved).toBeNull();
  await worker.evaluate(() => {
    Cache.prototype.put = (globalThis as any).originalPut;
  });
  await save(page);
});

test('キャンセル・別タブからの重複保存を処理し、再試行できる', async ({ page, context, request, site }) => {
  await ready(page, site);
  await control(request, { mode: 'delay' });
  await page.locator('#offlineSave').click();
  await expect(page.locator('#offlineMessage')).toContainText(delayedProgress(site, manifestOf(site)));
  const other = await context.newPage();
  await other.goto(site.course.route);
  await expect(other.locator('#offlineProgress')).toBeVisible();
  await expect(other.locator('#offlineSave')).toBeDisabled();
  await other.locator('#offlineCancel').click();
  await expect(page.locator('#offlineMessage')).toContainText('キャンセルしました');
  await expect(page.locator('#offlineProgress')).toBeHidden();
  await expect(other.locator('#offlineProgress')).toBeHidden();
  await expect(other.locator('#offlineMessage')).not.toContainText('保存中');
  expect((await status(page, site)).saved).toBeNull();
  await other.close();
  await control(request);
  await save(page);
});

test('教材更新：旧版の教材と動画を維持し、失敗後に再試行して完全な新版へ切り替える', async ({
  page,
  context,
  request,
  site,
}) => {
  await ready(page, site);
  await save(page);
  const original = (await status(page, site)).saved!;
  // 公開中の版と保存版が同じ間は、何が変わったかを出さない
  await expect(page.locator('#offlineNews')).toBeHidden();
  // 変わっていない動画は前の保存版から写して取りに来ないので、更新の失敗は、版の変わるポスターに差し込む
  await control(request, { mode: 'fail', update: true, faultTarget: 'poster' });
  await page.reload();
  expect(await page.title()).not.toContain('更新テスト');
  await page.locator('#offlineCheck').click();
  await expect(page.locator('#offlineSave')).toHaveText('新しい版に更新して保存');
  // 新しい版の案内に、何が変わったか（教材情報の news のうち、保存した日より後のもの）を出す
  await expect(page.locator('#offlineMessage')).toContainText('新しい版があります');
  await expect(page.locator('#offlineNews')).toBeVisible();
  await expect(page.locator('#offlineNewsList li').first()).toContainText(UPDATE_NEWS);
  await page.locator('#offlineSave').click();
  await expect(page.locator('#offlineMessage')).toContainText('再試行');
  expect((await status(page, site)).saved!.manifest.revision).toBe(original.manifest.revision);
  await context.setOffline(true);
  await page.reload();
  await playAndPause(page, seek(site, 30));
  await context.setOffline(false);
  await control(request, { update: true });
  await page.locator('#offlineCheck').click();
  await page.locator('#offlineSave').click();
  await expect(page.locator('#offlineReload')).toBeVisible();
  expect((await status(page, site)).saved!.manifest.revision).not.toBe(original.manifest.revision);
  // 更新後も直前の版の MP4 を混ぜずに返せる。
  const oldFile = original.manifest.files.find((f) => f.url.includes(`/${required(site.course.lectures[0]).id}.`))!;
  const oldRange = await page.evaluate(
    async (url) => (await fetch(new URL(url, location.origin + '/'), { headers: { Range: 'bytes=0-127' } })).status,
    oldFile.url,
  );
  expect(oldRange).toBe(206);
  await page.locator('#offlineReload').click();
  await expect(page).toHaveTitle(/更新テスト/);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle(/更新テスト/);
  await playAndPause(page, seek(site, 60));
  expect(
    await page.evaluate(
      async (id) => (await caches.keys()).filter((n) => n.includes(`:course:${id}:`)).length,
      site.course.id,
    ),
  ).toBe(2);
});

test('教材のページだけの更新では、変わっていない動画を前の保存版から写して取り直さない。写す元の中身が違えば取り直す（転送の量を測る）', async ({
  page,
  context,
  request,
  site,
}) => {
  await ready(page, site);
  const videos = manifestOf(site).files.filter((f) => f.type === 'video/mp4');
  const videoBytes = videos.reduce((n, f) => n + f.bytes, 0);
  const transfer: Record<string, Stats> = {};
  /** 保存版の revision が want になり、進み具合が消えるまで待つ（保存が終わるまで） */
  const savedAs = async (want: (revision: string | undefined) => boolean) => {
    await expect.poll(async () => want((await status(page, site)).saved?.manifest.revision)).toBe(true);
    await expect(page.locator('#offlineProgress')).toBeHidden();
  };
  const savedNow = async () => {
    const saved = (await status(page, site)).saved;
    if (!saved) throw new Error('保存版がありません');
    return saved;
  };
  await control(request);
  await save(page);
  transfer.firstSave = await stats(request);
  const original = await savedNow();
  // 教材のページとポスターの版だけを新しくする（動画の URL は SHA-256 入りで、変わらない）
  await control(request, { update: true });
  await page.locator('#offlineCheck').click();
  await expect(page.locator('#offlineSave')).toHaveText('新しい版に更新して保存');
  await page.locator('#offlineSave').click();
  await savedAs((r) => r !== undefined && r !== original.manifest.revision);
  transfer.pageOnlyUpdate = await stats(request);
  const updated = await savedNow();
  // 前の版に戻して保存し直す。写す元（新旧の両方の保存版）の 1 本の動画の中身だけを壊す（印の大きさと SHA-256 はそのまま）
  const broken = required(videos[0]);
  await page.evaluate(
    async ({ caches: names, url }) => {
      const key = new URL(url, `${location.origin}/`).href;
      for (const name of names) {
        const cache = await caches.open(name);
        const r = await cache.match(key);
        if (!r) throw new Error(`保存版に動画がありません: ${name}`);
        const data = new Uint8Array(await r.arrayBuffer());
        const byte = data[100];
        if (byte === undefined) throw new Error('破損の検査には 101 バイト以上の動画が要る');
        data[100] = byte ^ 255;
        await cache.put(key, new Response(data, { headers: r.headers }));
      }
    },
    { caches: [updated.cache, original.cache], url: broken.url },
  );
  await control(request);
  await page.locator('#offlineCheck').click();
  await expect(page.locator('#offlineSave')).toHaveText('新しい版に更新して保存');
  await page.locator('#offlineSave').click();
  await savedAs((r) => r === original.manifest.revision);
  transfer.brokenSource = await stats(request);
  writeFileSync(
    path.join(evidence(), 'transfer.json'),
    `${JSON.stringify({ videos: videos.length, videoBytes, ...transfer }, null, 2)}\n`,
  );
  expect(transfer.firstSave).toMatchObject({ fullVideoDownloads: videos.length, fullVideoBytes: videoBytes });
  expect(updated.manifest.revision).not.toBe(original.manifest.revision);
  expect(transfer.pageOnlyUpdate).toMatchObject({ fullVideoDownloads: 0, fullVideoBytes: 0 });
  expect(transfer.brokenSource).toMatchObject({ fullVideoDownloads: 1, fullVideoBytes: broken.bytes });
  // 写した動画も取り直した動画も、オフラインで再生でき、Range の中身が元の動画と同じ
  const saved = await savedNow();
  expect(saved.manifest.revision).toBe(original.manifest.revision);
  await context.setOffline(true);
  await page.reload();
  await waitForSaved(page);
  for (const [i, lecture] of site.course.lectures.entries()) {
    const file = saved.manifest.files.find((f) => f.type === 'video/mp4' && f.url.includes(`/${lecture.id}.`));
    if (!file) throw new Error(`保存版に ${lecture.id} の動画がありません`);
    const head = await page.evaluate(async (url) => {
      const r = await fetch(new URL(url, `${location.origin}/`), { headers: { Range: 'bytes=0-127' } });
      return { status: r.status, bytes: [...new Uint8Array(await r.arrayBuffer())] };
    }, file.url);
    expect(head, `${i + 1} 本目`).toEqual({ status: 206, bytes: [...readFileSync(lecture.video).subarray(0, 128)] });
  }
  await playAndPause(page, seek(site, 30));
  await context.setOffline(false);
});

test('起動用ファイルに JPEG でない画像（PNG）があっても、SW の install が通り、オフラインでも同じ型で返す', async ({
  page,
  context,
  site,
}) => {
  // 合成の講座は、一覧のページの画像（assets）に PNG を 1 枚足してある。本物の講座はアイコン（PNG）で見る（tests/e2e/sites.ts）
  const png = site.shellPng;
  await page.goto('/');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const shell = await page.evaluate(async (url) => {
    const name = (await caches.keys()).find((n) => n.includes(':shell:'));
    const r = name ? await (await caches.open(name)).match(new URL(url, `${location.origin}/`).href) : undefined;
    return { type: r?.headers.get('Content-Type') ?? null, bytes: r ? (await r.arrayBuffer()).byteLength : 0 };
  }, png);
  expect(shell.type).toBe('image/png');
  expect(shell.bytes).toBeGreaterThan(0);
  await context.setOffline(true);
  const offline = await page.evaluate(async (url) => {
    const r = await fetch(new URL(url, `${location.origin}/`));
    return { status: r.status, type: r.headers.get('Content-Type'), bytes: (await r.arrayBuffer()).byteLength };
  }, png);
  expect(offline).toEqual({ status: 200, type: 'image/png', bytes: shell.bytes });
  await context.setOffline(false);
});

test('無効の一覧に入れた revision の保存版は、オンラインでは公開中のページを返して更新を案内し、保存は消さない。オフラインでは保存版を返す', async ({
  request,
  site,
  baseURL,
}) => {
  // 新しい SW は、このサイトのタブを全部閉じると有効になる。ブラウザを閉じて開き直すと、決まって有効になるので、profile を残して開き直す
  const profile = mkdtempSync(path.join(tmpdir(), 'chalkfile-pwa-disabled-'));
  let context = await chromium.launchPersistentContext(profile, {
    channel,
    headless: true,
    baseURL: required(baseURL),
  });
  try {
    let page = await context.newPage();
    await ready(page, site);
    await save(page);
    const original = (await status(page, site)).saved;
    if (!original) throw new Error('保存版がありません');
    expect((await status(page, site)).disabled).toBe(false);
    // 直した版（教材のページの更新）を公開し、前の版の revision を無効の一覧に入れた sw.js を配る
    await control(request, { update: true, disabledRevisions: [original.manifest.revision] });
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update();
    });
    await expect(page.locator('#appUpdate')).toBeVisible();
    await context.close();
    context = await chromium.launchPersistentContext(profile, { channel, headless: true, baseURL: required(baseURL) });
    page = await context.newPage();
    await page.goto('/');
    await expect.poll(async () => (await status(page, site).catch(() => null))?.disabled ?? null).toBe(true);
    // オンライン: 保存版ではなく公開中のページ。更新して保存するよう案内する。保存版と記録はそのまま
    const online = await page.goto(site.course.route);
    expect(online?.fromServiceWorker()).toBeTruthy();
    await expect(page).toHaveTitle(/更新テスト/);
    await expect(page.locator('#offlineSave')).toHaveText('新しい版に更新して保存');
    await expect(page.locator('#offlineSave')).toBeEnabled();
    // 案内は更新だけ（開き直しても公開中のページになるので、「保存した版を開く」と「保存版が切り替わりました」は出さない）
    await expect(page.locator('#offlineMessage')).toContainText('保存した版には直した不具合がある');
    await expect(page.locator('#offlineReload')).toBeHidden();
    await expect(page.locator('#playbackStatus')).toContainText('オンライン再生');
    await expect(page.locator('#offlineNewsList li').first()).toContainText(UPDATE_NEWS);
    // 公開中のページのポスター（新しい版の ?v=。保存版には無い）と動画も、取って再生できる
    const poster = await page.locator('video').evaluate((v: HTMLVideoElement) => v.poster);
    expect(poster).toContain('?v=');
    expect(
      await page.evaluate(async (url) => {
        const r = await fetch(url);
        return { status: r.status, type: r.headers.get('Content-Type')?.split(';')[0] };
      }, poster),
    ).toEqual({ status: 200, type: 'image/jpeg' });
    await playAndPause(page, seek(site, 10));
    const kept = await status(page, site);
    expect(kept.saved?.manifest.revision).toBe(original.manifest.revision);
    expect(kept.saved?.cache).toBe(original.cache);
    expect(await page.evaluate((name) => caches.has(name), original.cache)).toBeTruthy();
    // オフライン: 保存版のページと動画で開ける
    await context.setOffline(true);
    await page.reload();
    await expect(page).not.toHaveTitle(/更新テスト/);
    await waitForSaved(page);
    await playAndPause(page, seek(site, 30));
    // オンラインに戻って更新すると、無効の一覧に無い新しい版になり、オンラインでも保存版を開く
    await context.setOffline(false);
    await page.goto(site.course.route);
    await expect(page.locator('#offlineSave')).toHaveText('新しい版に更新して保存');
    await page.locator('#offlineSave').click();
    await expect
      .poll(async () => (await status(page, site)).saved?.manifest.revision)
      .not.toBe(original.manifest.revision);
    expect((await status(page, site)).disabled).toBe(false);
    await expect(page.locator('#offlineProgress')).toBeHidden();
    await context.setOffline(true);
    await page.reload();
    await expect(page).toHaveTitle(/更新テスト/);
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
});

test('保存ファイルの欠損を検出し、保存済み表示と再生を止めて再保存できる', async ({ page, context, site }) => {
  await ready(page, site);
  await save(page);
  const stored = (await status(page, site)).saved!;
  await page.evaluate(
    async ({ cache, url }) => {
      await (await caches.open(cache)).delete(new URL(url, location.origin + '/').href);
    },
    {
      cache: stored.cache,
      url: stored.manifest.files.find((f) => f.url.includes(`/${required(site.course.lectures[1]).id}.`))!.url,
    },
  );
  await page.reload();
  await expect(page.locator('#savedState')).toContainText('保存が不完全');
  expect((await status(page, site)).saved).toBeNull();
  await context.setOffline(true);
  const response = await page.reload();
  expect(response!.status()).toBe(503);
  await expect(page.getByRole('heading', { name: 'この教材は保存されていません' })).toBeVisible();
  await context.setOffline(false);
  await page.goto(site.course.route);
  await expect(page.locator('#offlineSave')).toBeEnabled();
  await save(page);
});

test('読めない保存の記録は、動画を消さずに隔離して保存し直しを案内する。読めるように戻れば保存版に戻り、30日たった隔離だけを消す', async ({
  page,
  site,
}) => {
  await ready(page, site);
  await save(page);
  const saved = (await status(page, site)).saved!;
  // 検証を厳しくした版を真似て、記録を今の検証に通らない形にする（break）。text を渡すと、その本文に戻す
  const record = (text?: string) =>
    page.evaluate(
      async ({ text, id }) => {
        const registry = await caches.open('chalkfile:/:offline-v1:registry');
        const key = new URL(`.offline-records/${id}`, location.origin + '/').href;
        const before = await (await registry.match(key))!.text();
        const r = JSON.parse(before);
        r.versions[0].manifest.pageVersion = 'stricter';
        await registry.put(
          key,
          text ? new Response(text, { headers: { 'Content-Type': 'application/json' } }) : Response.json(r),
        );
        return before;
      },
      { text, id: site.course.id },
    );
  const marks = () => page.evaluate(async () => (await caches.keys()).filter((n) => n.startsWith('quarantine:')));
  const original = await record();
  await page.reload();
  await expect(page.locator('#savedState')).toContainText('保存が不完全');
  await expect(page.locator('#offlineMessage')).toHaveText('保存が不完全です。オンラインで保存し直してください。');
  await expect(page.locator('#offlineSave')).toHaveText('保存し直す');
  expect(await page.evaluate(() => caches.keys())).toContain(saved.cache);
  expect(await marks()).toEqual([expect.stringMatching(new RegExp(`^quarantine:\\d+:${saved.cache}$`))]);
  // 検証を直した版を真似て記録を戻すと、取り直さずに同じ保存版へ戻り、印は外れる
  await record(original);
  await page.reload();
  await waitForSaved(page);
  expect((await status(page, site)).saved!.cache).toBe(saved.cache);
  expect(await marks()).toEqual([]);
  // 隔離から30日たつと、中身の Cache と印を消す（記録は読めないまま残るので、保存し直しの案内は続く）
  await record();
  await page.reload();
  await expect(page.locator('#savedState')).toContainText('保存が不完全');
  const mark = required((await marks())[0]);
  await page.evaluate(
    async ({ mark, cache }) => {
      await caches.delete(mark);
      await caches.open(`quarantine:${Date.now() - 31 * 24 * 60 * 60 * 1000}:${cache}`);
    },
    { mark, cache: saved.cache },
  );
  await page.reload();
  await expect(page.locator('#savedState')).toContainText('保存が不完全');
  expect(
    await page.evaluate(
      async (id) => (await caches.keys()).filter((n) => n.includes(`:course:${id}:`)),
      site.course.id,
    ),
  ).toEqual([]);
  await save(page);
  expect(await marks()).toEqual([]);
});

test('オンラインで存在しない URL を開くと、保存されていないとは言わずに 404 のページを返す。オフラインは今までどおり', async ({
  page,
  context,
  site,
}) => {
  await ready(page, site);
  const online = await page.goto('/no-such-course/');
  expect(online!.fromServiceWorker()).toBeTruthy();
  expect(online!.status()).toBe(404);
  await expect(page.getByRole('heading', { name: '教材が見つかりません' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'この教材は保存されていません' })).toHaveCount(0);
  await context.setOffline(true);
  const offline = await page.reload();
  expect(offline!.status()).toBe(503);
  await expect(page.getByRole('heading', { name: 'この教材は保存されていません' })).toBeVisible();
  await context.setOffline(false);
});

test('外部動画を指す教材情報は拒否し、取得しない', async ({ page, request, site }) => {
  const requests: string[] = [];
  page.context().on('request', (r) => {
    if (r.url().includes('example.com')) requests.push(r.url());
  });
  await ready(page, site);
  await control(request, { mode: 'external' });
  await page.locator('#offlineCheck').click();
  await expect(page.locator('#offlineMessage')).toContainText('公開教材だけ');
  await expect(page.locator('#offlineSave')).toBeDisabled();
  expect(requests).toEqual([]);
});

test('ブラウザ完全終了後のオフライン起動とworker更新後にも保存を維持する', async ({ request, site, baseURL }) => {
  const profile = mkdtempSync(path.join(tmpdir(), 'chalkfile-pwa-restart-'));
  let context = await chromium.launchPersistentContext(profile, {
    channel,
    headless: true,
    baseURL: required(baseURL),
  });
  try {
    let page = await context.newPage();
    await ready(page, site);
    const cdp = await context.newCDPSession(page);
    const installability = await cdp.send('Page.getInstallabilityErrors');
    expect(installability.installabilityErrors).toEqual([]);
    await page.locator('#installHelp summary').click();
    await expect(page.locator('#pwaInstall')).toBeVisible();
    await page.screenshot({ path: path.join(evidence(), 'install-eligible.png'), fullPage: false });
    await save(page);
    await control(request, { workerUpdate: true });
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())!.update();
    });
    await expect(page.locator('#appUpdate')).toBeVisible();
    expect((await status(page, site)).saved).not.toBeNull();
    await context.close();
    context = await chromium.launchPersistentContext(profile, { channel, headless: true, baseURL: required(baseURL) });
    await context.setOffline(true);
    page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('#savedCourses')).toContainText('保存済み');
    await savedLink(page, site).click();
    await expect(page.locator('#savedState')).toContainText('保存済み');
    await playAndPause(page, seek(site, 90));
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
});

test('保存中にブラウザを終了しても、途中の講座を保存済みにせず再試行できる', async ({ request, site, baseURL }) => {
  const profile = mkdtempSync(path.join(tmpdir(), 'chalkfile-pwa-interrupt-'));
  let context = await chromium.launchPersistentContext(profile, {
    channel,
    headless: true,
    baseURL: required(baseURL),
  });
  try {
    let page = await context.newPage();
    await ready(page, site);
    await control(request, { mode: 'delay' });
    await page.locator('#offlineSave').click();
    await expect(page.locator('#offlineMessage')).toContainText(delayedProgress(site, manifestOf(site)));
    await context.close();
    await control(request);
    context = await chromium.launchPersistentContext(profile, { channel, headless: true, baseURL: required(baseURL) });
    page = await context.newPage();
    await ready(page, site);
    expect((await status(page, site)).saved).toBeNull();
    expect(
      await page.evaluate(
        async (id) => (await caches.keys()).filter((n) => n.includes(`:course:${id}:`)),
        site.course.id,
      ),
    ).toEqual([]);
    await save(page);
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
});

test('書体は外のサービスに接続せず、通信断でも保存したバイトと MIME で読める', async ({ page, context, site }) => {
  const externalFonts: string[] = [];
  page.on('request', (r) => {
    if (/fonts\.(?:googleapis|gstatic)\.com/.test(r.url())) externalFonts.push(r.url());
  });
  await ready(page, site);
  const fontDir = path.join(site.dist, 'fonts');
  const expected = readdirSync(fontDir)
    .filter((f) => f.endsWith('.woff2'))
    .map((f) => ({
      url: `/fonts/${f}`,
      bytes: [...readFileSync(path.join(fontDir, f))],
    }));
  expect(expected.length).toBeGreaterThan(0);
  await context.setOffline(true);
  for (const font of expected) {
    const got = await page.evaluate(async (url) => {
      const r = await fetch(url);
      return {
        status: r.status,
        type: r.headers.get('content-type')?.split(';')[0],
        bytes: [...new Uint8Array(await r.arrayBuffer())],
      };
    }, font.url);
    expect(got, font.url).toEqual({ status: 200, type: 'font/woff2', bytes: font.bytes });
  }
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => [...document.fonts].some((f) => f.status === 'loaded'))).toBe(true);
  expect(externalFonts).toEqual([]);
});
