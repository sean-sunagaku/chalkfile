import type { Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { CourseManifest, CourseStatus } from '../../site/offline-shared';
import { evidenceDir, expect, test } from './fixtures';
import { waitForSaved } from './fixtures';

// 多言語（本物の講座だけ。project real）: 言語の切り替え、訳の講座（動画は /media/<言語>/ から）の保存・オフライン再生・Range、
// 字幕を焼き込んだ版がある講座（お笑い版）の保存。先に npm run build:site -- --strict で site/dist を作り、手元に動画を置いてから流す
const evidence = () => {
  const dir = evidenceDir();
  mkdirSync(dir, { recursive: true });
  return dir;
};
const translatedPublished = existsSync('site/dist/en/pstack-comedy/offline-manifest.json');
const enManifest = translatedPublished
  ? (JSON.parse(readFileSync('site/dist/en/pstack-comedy/offline-manifest.json', 'utf8')) as CourseManifest)
  : null;

test.beforeEach(async ({ request }) => {
  expect((await request.post('/__test/control', { data: {} })).ok()).toBeTruthy();
});

async function status(page: Page, id: string): Promise<CourseStatus | undefined> {
  return page.evaluate(async (id) => {
    const reply = await new Promise<{ courses: CourseStatus[] }>((resolve) => {
      const c = new MessageChannel();
      c.port1.onmessage = (e) => {
        c.port1.close();
        resolve(e.data);
      };
      navigator.serviceWorker.controller!.postMessage({ protocol: 1, type: 'STATUS', lang: 'en' }, [c.port2]);
    });
    return reply.courses.find((s) => s.id === id);
  }, id);
}
/** 再生してから時刻へ移る（動画は preload="none" で、再生を押すまで読まない） */
async function playAt(page: Page, at: number) {
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
}
async function ready(page: Page, route: string) {
  await page.goto(route);
  await expect(page.locator('#offlineSave')).toBeEnabled();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

test.describe('多言語（公開対象のときだけ実行）', () => {
  test.skip(!translatedPublished, 'publishLangs は日本語だけ。M3 の訳は未公開。');

  test('言語の切り替え: 一覧と講座のページ・日本語だけの講座への案内・375px', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.locator('a.course[href="pstack-comedy/"] .facts')).toContainText('English・中文');
    await page.locator('nav.langs').getByRole('link', { name: 'English', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#courses-title')).toHaveText('Courses in English');
    // 訳していない講座は「日本語だけ」で、日本語のページへ
    await expect(page.locator('#more-courses a.course[href="../stripe-billing/"]')).toContainText('Japanese');
    await page.locator('a.course[href="pstack-comedy/"]').click();
    await expect(page).toHaveURL(/\/en\/pstack-comedy\/#P01$/);
    expect(await page.title()).toBe('Laugh & Learn: pstack | Chalkfile');
    await expect(page.locator('#tab-transcript')).toHaveText('Transcript');
    await expect(page.locator('#offlineHeading')).toHaveText('Study offline');
    // 字幕（WebVTT）の言語とプレーヤーの字幕の帯
    expect(await page.locator('video track').evaluate((t: HTMLTrackElement) => [t.srclang, t.label])).toEqual([
      'en',
      'English',
    ]);
    await page.locator('nav.langs').getByRole('link', { name: '中文', exact: true }).click();
    await expect(page).toHaveURL(/\/zh\/pstack-comedy\/#P01$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
    await expect(page.locator('#tab-quiz')).toHaveText('小测验');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await page.screenshot({ path: path.join(evidence(), 'i18n-zh-mobile-375.png'), fullPage: false });
    await page.locator('nav.langs').getByRole('link', { name: '日本語', exact: true }).click();
    await expect(page).toHaveURL(/\/pstack-comedy\/#P01$/);
    await expect(page.locator('#tab-transcript')).toHaveText('台本');
    expect(errors).toEqual([]);
  });

  test('英語の講座を保存し、通信なしで動画のサイトの動画を再生・Range・シーク・字幕の切り替えができる', async ({
    page,
    context,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await ready(page, '/en/pstack-comedy/');
    // 字幕オンが既定。字幕を焼き込んだ版を、動画のサイトから流す
    expect(await page.locator('video').evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(
      /\/media\/en\/pstack-comedy\/P01\.cc\.[a-f0-9]{64}\.mp4$/,
    );
    await playAt(page, 30);
    await page.locator('#offlineSave').click();
    await waitForSaved(page);
    const saved = (await status(page, 'en/pstack-comedy'))!.saved!;
    expect(saved.manifest.files.map((f) => f.url.split('?')[0])).toEqual(
      enManifest!.files.map((f) => f.url.split('?')[0]),
    );
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#savedState')).toContainText('Saved');
    await expect(page.locator('#networkState')).toContainText('Offline');
    await playAt(page, 120);
    const mp4 = enManifest!.files.find((f) => f.url.includes('/P01.') && !f.url.includes('/P01.cc.'))!;
    const source = readFileSync('site/media/P01.en.mp4');
    for (const [range, start, end] of [
      ['bytes=0-127', 0, 127],
      ['bytes=1000-1127', 1000, 1127],
      ['bytes=-128', source.length - 128, source.length - 1],
    ] as const) {
      const r = await page.evaluate(
        async ({ url, range }) => {
          const res = await fetch(new URL(url, location.origin + '/'), { headers: { Range: range } });
          return {
            status: res.status,
            bytes: [...new Uint8Array(await res.arrayBuffer())],
            etag: res.headers.get('ETag'),
          };
        },
        { url: mp4.url, range },
      );
      expect(r.status).toBe(206);
      expect(r.etag).toBe(`"${mp4.sha256}"`);
      expect(r.bytes).toEqual([...source.subarray(start, end + 1)]);
    }
    // 字幕オフ（字幕なしの版に差し替える）も、保存版で再生できる
    await page.locator('#ccToggle').click();
    await expect
      .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentSrc))
      .toMatch(/P01\.[a-f0-9]{64}\.mp4$/);
    await playAt(page, 60);
    await page.screenshot({ path: path.join(evidence(), 'i18n-en-offline-playback.png'), fullPage: false });
    await page.locator('#offlineDelete').click();
    await expect(page.locator('#savedState')).toContainText('Not saved');
    await context.setOffline(false);
    expect(errors).toEqual([]);
  });

  test('動画のサイトがまだ無くても Service Worker が入る。オフラインで、保存していない訳の動画とポスターには 503 を返す（一覧のページを返さない）', async ({
    page,
    request,
    context,
  }) => {
    expect((await request.post('/__test/control', { data: { mediaDown: true } })).ok()).toBeTruthy();
    // 起動用ファイルに動画のサイトのファイルが入っていると、install が失敗して worker が入らない
    await ready(page, '/en/pstack-comedy/');
    expect((await request.post('/__test/control', { data: {} })).ok()).toBeTruthy();
    await context.setOffline(true);
    const urls = enManifest!.files.map((f) => f.url).filter((u) => u.includes('/media/en/'));
    expect(urls.length).toBeGreaterThan(1);
    const got = await page.evaluate(
      async (urls) =>
        Promise.all(
          urls.map(async (url) => {
            const res = await fetch(new URL(url, location.origin + '/'));
            return { status: res.status, html: (res.headers.get('Content-Type') ?? '').includes('text/html') };
          }),
        ),
      urls,
    );
    for (const r of got) expect(r).toEqual({ status: 503, html: false });
    await context.setOffline(false);
  });

  test('学習の記録（見た位置）は言語ごとに分ける（動画の長さが違うので、日本語の続きから再生しない）', async ({
    page,
  }) => {
    await page.goto('/pstack-comedy/');
    await page.evaluate(() =>
      localStorage.setItem(
        'chalkfile:pstack-comedy:progress',
        JSON.stringify({ P01: { t: 200, max: 0.7, done: false } }),
      ),
    );
    await page.goto('/en/pstack-comedy/');
    const video = page.locator('video');
    // 動画は再生を押すまで読まない（preload="none"）。再生すると、続きの時刻があればそこへ移る
    const play = () =>
      video.evaluate(async (v: HTMLVideoElement) => {
        v.muted = true;
        await v.play();
      });
    await play();
    expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeLessThan(3);
    // 日本語のページは、前と同じ鍵の続きから再生する
    await page.goto('/pstack-comedy/');
    await play();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(190);
  });
});

test('字幕を焼き込んだ版がある講座（お笑い版）も保存できる', async ({ page }) => {
  await ready(page, '/pstack-comedy/');
  await page.locator('#offlineSave').click();
  await waitForSaved(page);
  const saved = (await status(page, 'pstack-comedy'))!.saved!;
  expect(saved.manifest.files).toHaveLength(4);
  expect(saved.manifest.files.filter((f) => f.type === 'video/mp4').map((f) => f.url)).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^\/media\/ja\/pstack-comedy\/P01\.[a-f0-9]{64}\.mp4$/),
      expect.stringMatching(/^\/media\/ja\/pstack-comedy\/P01\.cc\.[a-f0-9]{64}\.mp4$/),
    ]),
  );
  await page.context().setOffline(true);
  await page.reload();
  await playAt(page, 30);
  expect(await page.locator('video').evaluate((v: HTMLVideoElement) => v.currentSrc)).toContain('/P01.cc.');
  await page.locator('#ccToggle').click();
  await playAt(page, 60);
  expect(await page.locator('video').evaluate((v: HTMLVideoElement) => v.currentSrc)).not.toContain('/P01.cc.');
  const download = page.waitForEvent('download');
  await page.locator('#fileDownload').click();
  expect(await (await download).failure()).toBeNull();
  await page.locator('#offlineDelete').click();
  await expect(page.locator('#savedState')).toContainText('未保存');
});
