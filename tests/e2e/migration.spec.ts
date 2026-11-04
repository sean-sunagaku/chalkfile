import { readFileSync } from 'node:fs';
import type { CourseManifest } from '../../site/offline-shared';
import { expect, seek, test } from './fixtures';

// 旧 Pages（/chalkfile/）からの移行。前の公開（tests/fixtures/legacy-pages の本物の旧 SW）で保存したあと、公開済みの移行の案内
// （tests/fixtures/legacy-migration。今のソースから作り直さない）に替える。動画は、ci は合成の動画（保存の manifest もそれに合わせる）、
// real は凍結した一覧と同じハッシュの旧 P01（現在の動画が変わったら Releases から取り、検証して別に保存する）
test('公開していた旧SWから移行し、保存・記録・Rangeを残してオンラインで同じURLへ移る', async ({
  page,
  context,
  request,
  site,
}) => {
  await request.post('/__test/control', { data: { legacyPhase: 'old' } });
  await page.goto('/chalkfile/pstack-comedy/');
  await expect(page.locator('#offlineSave')).toBeEnabled();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.evaluate(async () => {
    localStorage.setItem(
      'chalkfile:pstack-comedy:notes',
      JSON.stringify([{ t: 10, text: '移行しても消さない学習メモ' }]),
    );
    await (await caches.open('neighbor-app')).put('/neighbor', new Response('keep'));
  });
  await page.locator('#offlineSave').click();
  await expect(page.locator('#savedState')).toContainText('保存済み・教材と全動画');
  const before = await page.evaluate(() => caches.keys());
  expect(before.some((n) => n.startsWith('chalkfile:/chalkfile/:offline-v1:course:pstack-comedy:'))).toBeTruthy();
  // 旧 SW が仕事をしている間（動画の応答を流している・STATUS に答えている）は、新しい SW が activate を待つ。
  // 移行の SW に替える前に、ページの動画の読み込みを止め、替わり終わるまでは旧 SW に話しかけない（このあとはページを開き直してから再生する）
  await page.locator('video').evaluate((v: HTMLVideoElement) => {
    v.removeAttribute('src');
    v.load();
  });
  await request.post('/__test/control', { data: { legacyPhase: 'migrated' } });
  const switched = page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }),
      ),
  );
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())!.update();
  });
  await switched;
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const c = new MessageChannel();
            c.port1.onmessage = (e) => {
              c.port1.close();
              resolve(e.data.migrated === true);
            };
            navigator.serviceWorker.controller!.postMessage({ protocol: 1, type: 'STATUS' }, [c.port2]);
            setTimeout(() => resolve(false), 1000);
          }),
      ),
    )
    .toBeTruthy();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#chalkfileMoved')).toContainText('新しい場所で保存し直してください');
  const video = page.locator('video');
  const at = seek(site, 30);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  await video.evaluate(async (v: HTMLVideoElement, at) => {
    v.muted = true;
    v.currentTime = at;
    await v.play();
  }, at);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(at + 0.2);
  await video.evaluate((v: HTMLVideoElement) => v.pause());
  const manifest = JSON.parse(
    readFileSync('tests/fixtures/legacy-pages/pstack-comedy/offline-manifest.json', 'utf8'),
  ) as CourseManifest;
  const mp4 = manifest.files.find((f) => f.type === 'video/mp4')!;
  const range = await page.evaluate(async (url) => {
    const r = await fetch(new URL(url, location.origin + '/chalkfile/'), { headers: { Range: 'bytes=1000-1127' } });
    return { status: r.status, bytes: [...new Uint8Array(await r.arrayBuffer())] };
  }, mp4.url);
  expect(range.status).toBe(206);
  expect(range.bytes).toEqual([...readFileSync(site.legacyVideo).subarray(1000, 1128)]);
  expect(await page.evaluate(() => caches.keys())).toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem('chalkfile:pstack-comedy:notes'))).toContain(
    '消さない学習メモ',
  );
  await context.setOffline(false);
  await context.route('https://chalkfile.com/**', (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<h1>移行先の到達確認</h1>' }),
  );
  await page.goto('/chalkfile/pstack-comedy/?from=legacy#P01');
  await expect(page).toHaveURL('https://chalkfile.com/pstack-comedy/?from=legacy#P01');
  await expect(page.getByRole('heading')).toHaveText('移行先の到達確認');
});

test('旧SWがない新規アクセスも、案内のJSでquery/hashを保って移る', async ({ page, context, request }) => {
  await request.post('/__test/control', { data: { legacyPhase: 'migrated' } });
  await context.route('https://chalkfile.com/**', (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<h1>移行先</h1>' }),
  );
  await page.goto('/chalkfile/nudge-product/?q=old#N01');
  await expect(page).toHaveURL('https://chalkfile.com/nudge-product/?q=old#N01');
});
