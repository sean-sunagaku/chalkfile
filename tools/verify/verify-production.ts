// 前提: 公開サイトと Chrome。専用 profile を使う。副作用: サイトへ接続し、講座・学習の記録・証跡を専用 profile と .work/evidence に保存する。権限: ネットワークとローカルへの書き込み。手動で流す。

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
// 本物の公開サイトを、認証情報のない専用Chrome profileで検証する。実行は手動のみ。
import { chromium, expect } from '@playwright/test';
import config from '../../chalkfile.config';
import { COURSES } from '../../content';
import type { CourseManifest } from '../../site/offline-shared';

const mode = process.argv[2];
if (!mode || !['legacy-before', 'legacy-after', 'offline', 'offline-restart', 'redirects'].includes(mode))
  throw new Error('legacy-before | legacy-after | offline | offline-restart | redirects を指定してください');
const root = path.resolve(import.meta.dir, '../..');
const evidence = path.join(root, '.work/evidence');
mkdirSync(evidence, { recursive: true });
const profile = path.join(
  evidence,
  `profile-${mode.startsWith('legacy') ? 'legacy' : mode === 'offline-restart' ? 'offline' : mode}`,
);
const resolveWww = process.env.CHALKFILE_WWW_RESOLVE_IP;
if (resolveWww && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(resolveWww)) throw new Error('検証用DNSの形式が不正です');
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chrome',
  headless: true,
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
  args: resolveWww ? [`--host-resolver-rules=MAP www.${new URL(config.origin).hostname} ${resolveWww}`] : [],
});
const page = context.pages()[0] ?? (await context.newPage());
const browser = context.browser()?.version();
const errors: string[] = [];
const csp: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
await context.exposeFunction('productionCsp', (directive: string) => csp.push(directive));
await context.addInitScript(() =>
  document.addEventListener('securitypolicyviolation', (e) => {
    void (window as any).productionCsp(e.violatedDirective);
  }),
);
const output: Record<string, unknown> = {
  mode,
  at: new Date().toISOString(),
  platform: process.platform,
  browser,
  headless: true,
  resolveWww,
};
const record = () =>
  writeFileSync(path.join(evidence, `production-${mode}.json`), JSON.stringify({ ...output, errors, csp }, null, 2));
async function ready(url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await expect(page.locator('#offlineSave')).toBeEnabled({ timeout: 30000 });
}
/** 再生してから時刻へ移る（動画は preload="none" で、再生を押すまで読まない） */
async function playAt(at: number) {
  const v = page.locator('video');
  await v.evaluate(async (v: HTMLVideoElement, time) => {
    v.muted = true;
    await v.play();
    v.currentTime = time;
  }, at);
  await expect
    .poll(() => v.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 30000 })
    .toBeGreaterThan(at + 0.4);
  expect(await v.evaluate((v: HTMLVideoElement) => v.getVideoPlaybackQuality().totalVideoFrames)).toBeGreaterThan(0);
  await v.evaluate((v: HTMLVideoElement) => v.pause());
}
async function save() {
  await page.locator('#offlineSave').click();
  await expect(page.locator('#offlineSave')).toBeDisabled({ timeout: 240000 });
  await expect(page.locator('#offlineDelete')).toBeEnabled({ timeout: 240000 });
  await expect(page.locator('#offlineProgress')).toBeHidden();
}
async function offlineRange(manifest: CourseManifest, base: string) {
  const file = manifest.files.find((f) => f.type === 'video/mp4')!;
  const result = await page.evaluate(
    async ({ url, base }) => {
      const response = await fetch(new URL(url, base), { headers: { Range: 'bytes=1000-1127' } });
      return { status: response.status, bytes: [...new Uint8Array(await response.arrayBuffer())] };
    },
    { url: file.url, base },
  );
  expect(result.status).toBe(206);
  const name = /\/(\w+)\./.exec(file.url)![1];
  expect(result.bytes).toEqual([...readFileSync(path.join(root, 'site/media', `${name}.mp4`)).subarray(1000, 1128)]);
  return result.status;
}
try {
  if (mode === 'legacy-before') {
    await ready('https://sean-sunagaku.github.io/chalkfile/pstack-comedy/');
    expect(new URL(page.url()).origin).toBe('https://sean-sunagaku.github.io');
    await page.evaluate(() => {
      localStorage.setItem('chalkfile:pstack-comedy:notes', JSON.stringify([{ t: 10, text: '移行検証の公開用メモ' }]));
    });
    await save();
    await context.setOffline(true);
    await page.reload();
    await playAt(30);
    output.caches = await page.evaluate(() => caches.keys());
    output.saved = true;
    output.offlinePlayback = true;
    output.notes = await page.evaluate(() => localStorage.getItem('chalkfile:pstack-comedy:notes'));
    await page.screenshot({ path: path.join(evidence, 'legacy-before-offline.png') });
  } else if (mode === 'legacy-after') {
    const before = JSON.parse(readFileSync(path.join(evidence, 'production-legacy-before.json'), 'utf8'));
    await context.setOffline(true);
    await page.goto('https://sean-sunagaku.github.io/chalkfile/pstack-comedy/');
    await context.setOffline(false);
    await expect
      .poll(
        async () => {
          await page.evaluate(async () => {
            await (await navigator.serviceWorker.getRegistration())!.update();
          });
          return page.evaluate(
            () =>
              new Promise<boolean>((resolve) => {
                const channel = new MessageChannel();
                channel.port1.onmessage = (e) => {
                  channel.port1.close();
                  resolve(e.data.migrated === true);
                };
                navigator.serviceWorker.controller!.postMessage({ protocol: 1, type: 'STATUS' }, [channel.port2]);
                setTimeout(() => resolve(false), 1000);
              }),
          );
        },
        { timeout: 60000 },
      )
      .toBeTruthy();
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#chalkfileMoved')).toContainText('新しい場所で保存し直してください');
    await playAt(90);
    output.range = await offlineRange(
      JSON.parse(
        readFileSync(path.join(root, 'tests/fixtures/legacy-pages/pstack-comedy/offline-manifest.json'), 'utf8'),
      ),
      'https://sean-sunagaku.github.io/chalkfile/',
    );
    expect(await page.evaluate(() => caches.keys())).toEqual(before.caches);
    expect(await page.evaluate(() => localStorage.getItem('chalkfile:pstack-comedy:notes'))).toBe(before.notes);
    output.savedCachesUnchanged = true;
    output.notesUnchanged = true;
    output.offlineSeek = true;
    await page.screenshot({ path: path.join(evidence, 'legacy-after-offline.png') });
    await context.setOffline(false);
    await page.goto('https://sean-sunagaku.github.io/chalkfile/pstack-comedy/?from=legacy#P01');
    await expect(page).toHaveURL(new URL('pstack-comedy/?from=legacy#P01', config.origin).href, { timeout: 30000 });
    output.redirect = page.url();
  } else if (mode === 'offline') {
    const saved: string[] = [];
    output.saved = saved;
    for (const course of COURSES) {
      await ready(`${config.origin}${course.id}/`);
      await save();
      saved.push(course.id);
      record();
      console.log(`本番で保存: ${course.id}`);
    }
  } else if (mode === 'offline-restart') {
    await context.setOffline(true);
    const p = page;
    const checks: string[] = [];
    try {
      for (const course of COURSES) {
        await p.goto(`${config.origin}${course.id}/`);
        await expect(p.locator('#offlineSave')).toBeDisabled();
        await expect(p.locator('#offlineDelete')).toBeEnabled();
        await p.locator('video').evaluate(async (v: HTMLVideoElement) => {
          v.muted = true;
          await v.play();
          v.currentTime = 30;
        });
        await expect
          .poll(() => p.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime))
          .toBeGreaterThan(30.4);
        await p.locator('video').evaluate((v: HTMLVideoElement) => v.pause());
        checks.push(course.id);
        output.offlineRestartPlayback = checks;
        record();
        console.log(`本番で再起動後のオフライン再生・シーク: ${course.id}`);
      }
      await p.goto(new URL('rive-comedy/', config.origin).href);
      if ((await p.locator('#ccToggle').getAttribute('aria-pressed')) !== 'true') await p.locator('#ccToggle').click();
      await expect.poll(() => p.locator('video').evaluate((v: HTMLVideoElement) => v.currentSrc)).toContain('/R01.cc.');
      await playAt(30);
      await p.locator('#ccToggle').click();
      await expect
        .poll(() => p.locator('video').evaluate((v: HTMLVideoElement) => v.currentSrc))
        .not.toContain('/R01.cc.');
      await playAt(90);
      const download = p.waitForEvent('download');
      await p.locator('#fileDownload').click();
      const file = await download;
      expect(await file.failure()).toBeNull();
      const digest = createHash('sha256')
        .update(readFileSync((await file.path())!))
        .digest('hex');
      const manifest = JSON.parse(readFileSync(path.join(root, 'content/rive-comedy/generated/media.ja.json'), 'utf8'));
      expect(digest).toBe(manifest.entries.find((m: any) => m.lecture === 'R01' && m.kind === 'standard').sha256);
      output.offlineRestartPlayback = checks;
      output.captionToggleAndSeek = true;
      output.downloadSha256 = digest;
      await p.screenshot({ path: path.join(evidence, 'production-offline-restarted.png') });
    } finally {
      /* profile は最外側で閉じる。保存データは検証の再実行用に保持する。 */
    }
  } else if (mode === 'redirects') {
    const redirects: string[] = [];
    output.redirects = redirects;
    for (const route of ['', ...COURSES.map((c) => `${c.id}/`), 'unknown-path/']) {
      // 講座側が未知のhashを先頭講義IDへ正規化する既存動作と、移行処理を分けて確認する。
      const hash = COURSES.find((c) => `${c.id}/` === route)?.lectures[0]?.id ?? 'kept';
      await page.goto(`https://sean-sunagaku.github.io/chalkfile/${route}?from=migration#${hash}`);
      await expect(page).toHaveURL(`${config.origin}${route}?from=migration#${hash}`, { timeout: 30000 });
      redirects.push(page.url());
    }
    await page.goto(new URL('pstack-comedy/?from=www#P01', config.origin.replace('://', '://www.')).href);
    await expect(page).toHaveURL(new URL('pstack-comedy/?from=www#P01', config.origin).href, { timeout: 30000 });
    output.www = page.url();
  }
  expect(errors).toEqual([]);
  expect(csp).toEqual([]);
  output.passed = true;
  record();
  console.log(`${mode}: 成功`);
} catch (error) {
  output.passed = false;
  record();
  throw error;
} finally {
  await context.close();
}
