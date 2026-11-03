// ブラウザのテストの共通の部品。テストは @playwright/test の代わりに、ここの test と expect を使う。
//   site: テストごとのセッション（テストのサーバーが、別の番号で講座サイトを配る。tests/e2e/site.ts の SiteSession）。
//         page・context・request の baseURL は、このセッションの URL になる
//   siteMode: どちらのサイトか（playwright.config.ts の project が決める。ci は合成の講座、real は本物の講座）
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';
import type { CourseManifest } from '../../site/offline-shared';
import type { SiteMode, SiteSession } from '../e2e/site';

/** テストのサーバー（playwright.config.ts の webServer が「chalkfile-e2e: <URL>」から読み、ここに渡す） */
const hub = () => {
  const url = process.env.CHALKFILE_E2E_HUB;
  if (!url) throw new Error('テストのサーバーの URL がありません（npm run test:e2e:ci などから流す）');
  return url;
};

export const test = base.extend<{ site: SiteSession }, { siteMode: SiteMode }>({
  siteMode: ['real', { scope: 'worker', option: true }],
  site: async ({ siteMode }, use) => {
    const r = await fetch(new URL('/__test/session', hub()), {
      method: 'POST',
      body: JSON.stringify({ site: siteMode }),
    });
    if (!r.ok) throw new Error(`テストのサーバーが講座サイトを用意できません（${r.status}）: ${await r.text()}`);
    const session = (await r.json()) as SiteSession;
    await use(session);
    await fetch(new URL(`/__test/session/${session.id}`, hub()), { method: 'DELETE' }).catch(() => undefined);
  },
  baseURL: async ({ site }, use) => {
    await use(site.origin);
  },
});
export { expect };

/**
 * ページを開き、SW が動き出してから開き直す（一覧のページの初めの案内を確かめるテスト用）。
 * 初めて開いたとき、SW が動き出す前（register のあと、ready の前）に pageshow が保存状態を問い合わせると、
 * 「保存機能を準備できません」が出て、そのあと初めの案内で上書きされない競合がある（site/offline-client.ts の refresh）。
 * 遅い CI の runner で出る。直すとページの版が変わるので、ページを変える回で直し、そのときにこの開き直しをやめて、
 * 初めて開いたときを確かめるテストを足す
 */
export const openWithActiveWorker = async (page: Page, url: string) => {
  await page.goto(url);
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 60000 });
  await page.reload();
};

/** 使うブラウザ（既定は入れてある Chrome。CI は PW_CHANNEL=chromium で Playwright の Chromium） */
export const channel = process.env.PW_CHANNEL ?? 'chrome';

/** 証跡（スクリーンショット・結果の JSON）の置き場所。project ごとに分ける（既定は作業フォルダの .work/evidence/browser。playwright.config.ts） */
export const evidenceDir = (sub = '') =>
  path.join(process.env.CHALKFILE_EVIDENCE_DIR ?? '.work/evidence/browser', test.info().project.name, sub);

/** 講座の保存の manifest（組み立てたサイトの <講座>/offline-manifest.json） */
export const manifestOf = (site: SiteSession): CourseManifest =>
  JSON.parse(readFileSync(path.join(site.dist, site.course.id, 'offline-manifest.json'), 'utf8')) as CourseManifest;

/** 動画の中の時刻。本物の講座はそのまま、合成の講座（短い動画）は、終わりまで余裕のある時刻にする */
export const seek = (site: SiteSession, seconds: number) =>
  site.videoSeconds === null ? seconds : Math.min(site.videoSeconds / 2, seconds / 50);

/** 保存の進み具合の文（「6 / 27」）。保存は manifest の順に 1 つずつ取るので、遅れを差し込んだ動画（faultLecture）で止まって見える */
export const delayedProgress = (site: SiteSession, manifest: CourseManifest) => {
  const at = manifest.files.findIndex((f) => f.type === 'video/mp4' && f.url.includes(`/${site.course.faultLecture}.`));
  return `${at + 1} / ${manifest.files.length}`;
};
