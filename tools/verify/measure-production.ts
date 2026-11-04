// 前提: Chrome と、Cloudflare のログを読む認証。副作用: wrangler tail・公開サイトへの検証要求・専用 profile と証跡の保存。権限: Cloudflare のログ読み取り・ネットワーク・ローカルへの書き込み。持ち主が手動で流す。

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
// Cloudflare側で検証用ヘッダーを持つ自分の要求だけを抽出する。生ログは表示・保存しない。
import { chromium, expect } from '@playwright/test';
import config from '../../chalkfile.config';

const root = path.resolve(import.meta.dir, '../..');
const evidence = path.join(root, '.work/evidence');
mkdirSync(evidence, { recursive: true });
const marker = crypto.randomUUID();
const events: { path: string; method: string; range?: string; status?: number; outcome?: string }[] = [];
let connected!: () => void;
let hasConnected = false;
const ready = new Promise<void>((resolve) => {
  connected = resolve;
});
const tail = Bun.spawn(
  [
    path.join(root, 'node_modules/.bin/wrangler'),
    'tail',
    'chalkfile',
    '--env=',
    '--format=json',
    '--header',
    `X-Chalkfile-Verify: ${marker}`,
  ],
  {
    cwd: root,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    stdout: 'pipe',
    stderr: 'ignore',
  },
);
const reader = (async () => {
  const decoder = new TextDecoder();
  let pending = '';
  let object = '';
  for await (const chunk of tail.stdout) {
    pending += decoder.decode(chunk, { stream: true });
    for (let end = pending.indexOf('\n'); end >= 0; end = pending.indexOf('\n')) {
      const line = pending.slice(0, end);
      pending = pending.slice(end + 1);
      if (line.includes('Connected to chalkfile, waiting for logs')) connected();
      if (!object && !line.startsWith('{')) continue;
      object += line + '\n';
      if (object.length > 2_000_000) throw new Error('検証ログの形式を確認できません。生ログは表示しません。');
      try {
        const value = JSON.parse(object);
        object = '';
        const req = value.event?.request;
        if (!req?.url) continue;
        const url = new URL(req.url);
        if (url.origin === new URL(config.origin).origin && url.pathname.startsWith('/media/')) {
          if (req.method === 'HEAD') {
            hasConnected = true;
            connected();
            continue;
          }
          events.push({
            path: url.pathname,
            method: req.method,
            range: req.headers?.range,
            status: value.event?.response?.status,
            outcome: value.outcome,
          });
          console.log(`検証用のWorker要求: ${events.length}件`);
        }
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
  }
})();
const profile = mkdtempSync(path.join(evidence, 'profile-edge-'));
let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
try {
  // JSON出力は接続メッセージを出さない。本文なしの自分のHEADで接続を確認し、再生件数から除く。
  const manifest = await Bun.file(path.join(root, 'content/rive-comedy/generated/media.ja.json')).json();
  const entry = manifest.entries.find((e: any) => e.lecture === 'R01' && e.kind === 'standard');
  const probe = (async () => {
    for (let i = 0; i < 12 && !hasConnected; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!hasConnected)
        await fetch(`${config.origin}media/ja/rive-comedy/${entry.filename}`, {
          method: 'HEAD',
          headers: { 'X-Chalkfile-Verify': marker },
        });
    }
  })();
  await Promise.race([
    ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Worker測定へ接続できません。')), 30000)),
  ]);
  await probe;
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    headless: true,
    extraHTTPHeaders: { 'X-Chalkfile-Verify': marker },
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(new URL('rive-comedy/', config.origin).href, { waitUntil: 'domcontentloaded' });
  const video = page.locator('video');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 30000 })
    .toBeGreaterThanOrEqual(1);
  const startedAt = new Date().toISOString();
  const duration = await video.evaluate((v: HTMLVideoElement) => v.duration);
  await video.evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    v.playbackRate = 1;
    v.currentTime = 0;
    await v.play();
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.ended), { timeout: 360000, intervals: [1000] })
    .toBeTruthy();
  const frames = await video.evaluate((v: HTMLVideoElement) => v.getVideoPlaybackQuality().totalVideoFrames);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  expect(events.length).toBeGreaterThan(0);
  const result = {
    startedAt,
    endedAt: new Date().toISOString(),
    browser: context.browser()?.version(),
    platform: process.platform,
    headless: true,
    course: 'rive-comedy',
    lecture: 'R01.cc',
    duration,
    playbackRate: 1,
    ended: true,
    frames,
    method:
      'fresh profile; metadata then default captioned video to ended; Cloudflare tail filtered server-side by unique non-secret verification header; raw logs and headers not retained',
    requests: events,
    mediaRequestCount: events.length,
    referencePlaysPerDay: Math.floor(100000 / events.length),
  };
  writeFileSync(path.join(evidence, 'production-edge-measurement.json'), JSON.stringify(result, null, 2));
  console.log(`通常速度で最後まで再生: Worker ${events.length}要求 / 参考 ${result.referencePlaysPerDay}再生/日`);
} finally {
  await context?.close();
  tail.kill();
  await reader;
}
