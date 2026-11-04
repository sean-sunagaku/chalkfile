// 前提: 組み立てたサイト・Chrome・手元の動画。副作用: ローカルサーバーを起動し、専用 profile で講座を保存し、指定日の tests/fixtures/saved-records に記録を書く。権限: localhost の待ち受け・ローカルへの書き込み。手動で流す。

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
// 利用者の保存の記録を、互換テスト（tests/unit/offline-compat.test.ts）の fixture にする。実行は手動のみ。
// 本物の Chrome で今の site/dist/sw.js に全講座を保存させ、Cache API に書いた registry の記録をそのまま取り出す。
// 旧 Pages（scope /chalkfile/）の記録は、tests/fixtures/legacy-pages の本物の旧 SW で取る。動画は fixture に入れない。
// 使い方: bun scripts/build_site.ts --strict のあとに bun tools/verify/capture-saved-records.ts <日付>
// tests/e2e/browser-server.ts を 127.0.0.1:8877 で起動する（PW_PORT で変える。使っていれば止まる）
import { chromium, type Page } from '@playwright/test';
import config from '../../chalkfile.config';
import { isLangFolder } from '../../content/langs';
import legacyConfig from '../../site/legacy-config.json';
import type { CourseManifest, SavedVersion } from '../../site/offline-shared';

const root = path.resolve(import.meta.dir, '../..');
const date = process.argv[2];
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('fixture の日付（例: 2026-11-02）を指定してください');
const out = path.join(root, 'tests/fixtures/saved-records', date);
if (existsSync(out)) throw new Error(`${path.relative(root, out)} はもうあります。fixture は足すだけで、書き換えない`);
const port = process.env.PW_PORT ?? '8877';
const base = `http://127.0.0.1:${port}`;
const dist = path.join(root, 'site/dist');
const ids = readdirSync(dist).filter((d) => existsSync(path.join(dist, d, 'offline-manifest.json')));
// 訳の講座（en/… など）は、公開したら同じ形で足す
for (const lang of readdirSync(dist).filter(isLangFolder)) {
  for (const d of readdirSync(path.join(dist, lang)))
    if (existsSync(path.join(dist, lang, d, 'offline-manifest.json'))) ids.push(`${lang}/${d}`);
}
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const write = (file: string, data: string | Buffer) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, data);
};
const json = (file: string, value: unknown) => write(file, `${JSON.stringify(value, null, 2)}\n`);

async function control(state: Record<string, unknown> = {}) {
  if (!(await fetch(`${base}/__test/control`, { method: 'POST', body: JSON.stringify(state) })).ok)
    throw new Error('テスト用サーバーを切り替えられません');
}
/** 画面のボタンと同じ要求を SW に送る（保存の進捗は読み捨てる） */
async function save(page: Page, id: string) {
  const reply = await page.evaluate(
    (id) =>
      new Promise<{ ok?: boolean; error?: string }>((resolve) => {
        const c = new MessageChannel();
        c.port1.onmessage = (e) => {
          if (!e.data.progress) {
            c.port1.close();
            resolve(e.data);
          }
        };
        navigator.serviceWorker.controller!.postMessage({ protocol: 1, type: 'SAVE', id, lang: 'ja' }, [c.port2]);
      }),
    id,
  );
  if (!reply.ok) throw new Error(`${id} を保存できません: ${reply.error}`);
}
/** registry の記録を、Cache API に書かれた本文のまま読む（キーは scope からの相対） */
async function registry(page: Page, name: string, scope: string) {
  return page.evaluate(
    async ({ name, scope }) => {
      const cache = await caches.open(name);
      const rows: { key: string; type: string | null; body: string }[] = [];
      for (const r of await cache.keys()) {
        const res = (await cache.match(r))!;
        rows.push({
          key: r.url.slice(new URL(scope, location.origin).href.length),
          type: res.headers.get('Content-Type'),
          body: await res.text(),
        });
      }
      return rows;
    },
    { name, scope },
  );
}
const recordFile = (era: string, id: string, name = 'record.json') => path.join(out, era, encodeURIComponent(id), name);

// テストのサーバーそのものが、本物の講座のセッションとして答える（障害の差し込みの状態も、このサーバーのもの）
const server = Bun.spawn(['bun', 'tests/e2e/browser-server.ts'], {
  cwd: root,
  stdout: 'ignore',
  stderr: 'inherit',
  env: { ...process.env, PW_PORT: port },
});
const profile = mkdtempSync(path.join(tmpdir(), 'chalkfile-saved-records-'));
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${base}/__test/health`)).ok) break;
    } catch {
      /* 起動待ち */
    }
    if (i > 150) throw new Error('テスト用サーバーが起動しません');
    await Bun.sleep(200);
  }
  await control();
  const context = await chromium.launchPersistentContext(profile, {
    channel: process.env.PW_CHANNEL ?? 'chrome',
    headless: true,
    baseURL: base,
  });
  const browser = context.browser()?.version() ?? '';
  try {
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    // 1. chalkfile.com（scope /）: 全講座を 1 回ずつ保存する
    for (const id of ids) await save(page, id);
    const prefix = 'chalkfile:/:offline-v1:';
    for (const row of await registry(page, `${prefix}registry`, '/')) {
      const id = decodeURIComponent(row.key.split('/').pop()!);
      write(recordFile('workers', id), row.body);
    }
    for (const id of ids)
      write(
        recordFile('workers', id, 'offline-manifest.json'),
        readFileSync(path.join(dist, id, 'offline-manifest.json')),
      );
    const cachesAfterSave = (await page.evaluate(() => caches.keys())).filter((n) => n.startsWith(prefix)).sort();
    const registryKeys = (await registry(page, `${prefix}registry`, '/')).map((r) => ({ key: r.key, type: r.type }));
    // 2. 更新して保存（新しい版と、前の完全な版の 2 つを持つ記録）。教材の更新はテスト用サーバーの update で作る
    await control({ update: true });
    await save(page, 'stripe-billing');
    await control();
    const updated = (await registry(page, `${prefix}registry`, '/')).find(
      (r) => r.key === '.offline-records/stripe-billing',
    )!;
    write(recordFile('workers', 'stripe-billing', 'record-updated.json'), updated.body);
    json(path.join(out, 'workers/caches.json'), { caches: cachesAfterSave, registry: registryKeys });
    // 3. 旧 Pages（scope /chalkfile/）: 本物の旧 SW で pstack-comedy を保存する（旧サーバーが配る講座はこれだけ）
    await page.goto('/chalkfile/pstack-comedy/');
    await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/chalkfile/sw.js'));
    await save(page, 'pstack-comedy');
    const legacyPrefix = `chalkfile:${legacyConfig.scope}:offline-v1:`;
    const legacy = (await registry(page, `${legacyPrefix}registry`, legacyConfig.scope)).find(
      (r) => r.key === '.offline-records/pstack-comedy',
    )!;
    write(recordFile('legacy-pages', 'pstack-comedy'), legacy.body);
    // 旧 Pages の最後の公開（legacy-config.json の snapshot）の教材情報。記録は pstack-comedy の実録と同じ形で組む
    const captured = (JSON.parse(legacy.body) as { versions: SavedVersion[] }).versions[0];
    if (!captured) throw new Error('旧 Pages の保存記録に版が無い');
    const legacyIds = git('ls-tree', '-r', '--name-only', legacyConfig.snapshot)
      .split('\n')
      .flatMap((f) => /^([^/]+)\/offline-manifest\.json$/.exec(f)?.[1] ?? []);
    for (const id of legacyIds) {
      const text = execFileSync('git', ['show', `${legacyConfig.snapshot}:${id}/offline-manifest.json`], {
        cwd: root,
        encoding: 'utf8',
      });
      write(recordFile('legacy-pages', id, 'offline-manifest.json'), text);
      if (id === 'pstack-comedy') continue;
      const version: SavedVersion = {
        cache: `${legacyPrefix}course:${id}:${crypto.randomUUID()}`,
        manifest: JSON.parse(text) as CourseManifest,
        savedAt: captured.savedAt,
      };
      write(recordFile('legacy-pages', id), JSON.stringify({ versions: [version] }));
    }
    json(path.join(out, 'legacy-pages/caches.json'), {
      caches: (await page.evaluate(() => caches.keys())).filter((n) => n.startsWith(legacyPrefix)).sort(),
    });
    json(path.join(out, 'index.json'), {
      capturedAt: new Date().toISOString(),
      source: git('rev-parse', 'HEAD'),
      browser,
      eras: {
        workers: {
          scope: new URL('', config.origin).href,
          prefix,
          reader: 'sw',
          mediaRoots: {},
          note: `今の main で組んだ site/dist の全講座を、本物の Chrome と site/dist/sw.js で保存した記録（record.json）。record-updated.json は教材の更新を保存した後の記録`,
        },
        'legacy-pages': {
          scope: `https://sean-sunagaku.github.io${legacyConfig.scope}`,
          prefix: legacyPrefix,
          reader: 'legacy-sw',
          mediaRoots: { en: '/chalkfile-media-en/', zh: '/chalkfile-media-zh/' },
          captured: ['pstack-comedy'],
          composed: legacyIds.filter((id) => id !== 'pstack-comedy'),
          note: `旧 Pages の最後の公開（${legacyConfig.snapshot}）の教材情報。pstack-comedy は本物の旧 SW で保存した記録、ほかは同じ形で組んだ記録`,
        },
      },
    });
  } finally {
    await context.close();
  }
  console.log(`${path.relative(root, out)}: ${ids.length} 講座と旧 Pages の記録を保存しました`);
} finally {
  server.kill();
  rmSync(profile, { recursive: true, force: true });
}
