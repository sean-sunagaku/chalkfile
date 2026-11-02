import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { CourseManifest } from '../../site/offline-shared';

test('公開していた旧SWから移行し、保存・記録・Rangeを残してオンラインで同じURLへ移る', async ({ page, context, request }) => {
  await request.post('/__test/control', { data: { legacyPhase: 'old' } });
  await page.goto('/chalkfile/pstack-comedy/');
  await expect(page.locator('#offlineSave')).toBeEnabled();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.evaluate(async () => {
    localStorage.setItem('chalkfile:pstack-comedy:notes', JSON.stringify([{ t: 10, text: '移行しても消さない学習メモ' }]));
    await (await caches.open('neighbor-app')).put('/neighbor', new Response('keep'));
  });
  await page.locator('#offlineSave').click();
  await expect(page.locator('#savedState')).toContainText('保存済み・教材と全動画');
  const before = await page.evaluate(() => caches.keys());
  expect(before.some((n) => n.startsWith('chalkfile:/chalkfile/:offline-v1:course:pstack-comedy:'))).toBeTruthy();
  await request.post('/__test/control', { data: { legacyPhase: 'migrated' } });
  await expect.poll(async () => { await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
    return page.evaluate(() => new Promise<boolean>((resolve) => {
    const c = new MessageChannel(); c.port1.onmessage = (e) => { c.port1.close(); resolve(e.data.migrated === true); };
    navigator.serviceWorker.controller!.postMessage({ protocol: 1, type: 'STATUS' }, [c.port2]);
    setTimeout(() => resolve(false), 1000);
  })); }).toBeTruthy();
  await context.setOffline(true); await page.reload();
  await expect(page.locator('#chalkfileMoved')).toContainText('新しい場所で保存し直してください');
  const video = page.locator('video');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  await video.evaluate(async (v: HTMLVideoElement) => { v.muted = true; v.currentTime = 30; await v.play(); });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(30.2);
  await video.evaluate((v: HTMLVideoElement) => v.pause());
  const manifest = JSON.parse(readFileSync('tests/fixtures/legacy-pages/pstack-comedy/offline-manifest.json', 'utf8')) as CourseManifest;
  const mp4 = manifest.files.find((f) => f.type === 'video/mp4')!;
  const range = await page.evaluate(async (url) => {
    const r = await fetch(new URL(url, location.origin + '/chalkfile/'), { headers: { Range: 'bytes=1000-1127' } });
    return { status: r.status, bytes: [...new Uint8Array(await r.arrayBuffer())] };
  }, mp4.url);
  expect(range.status).toBe(206);
  expect(range.bytes).toEqual([...readFileSync('site/media/P01.mp4').subarray(1000, 1128)]);
  expect(await page.evaluate(() => caches.keys())).toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem('chalkfile:pstack-comedy:notes'))).toContain('消さない学習メモ');
  await context.setOffline(false);
  await context.route('https://chalkfile.com/**', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<h1>移行先の到達確認</h1>' }));
  await page.goto('/chalkfile/pstack-comedy/?from=legacy#P01');
  await expect(page).toHaveURL('https://chalkfile.com/pstack-comedy/?from=legacy#P01');
  await expect(page.getByRole('heading')).toHaveText('移行先の到達確認');
});

test('旧SWがない新規アクセスも、案内のJSでquery/hashを保って移る', async ({ page, context, request }) => {
  await request.post('/__test/control', { data: { legacyPhase: 'migrated' } });
  await context.route('https://chalkfile.com/**', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<h1>移行先</h1>' }));
  await page.goto('/chalkfile/nudge-product/?q=old#N01');
  await expect(page).toHaveURL('https://chalkfile.com/nudge-product/?q=old#N01');
});
