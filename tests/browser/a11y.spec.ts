import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { SiteSession } from '../e2e/site';
import { expect, test } from './fixtures';

// アクセシビリティの検査（axe-core の既定の規則）。合成の講座（project ci）のページで見る（本物の講座は中身が増えると結果が変わる）。
// 今ある違反は tests/fixtures/a11y-known/<ページ>.json に並べて許し、新しい違反が出たら落ちる。直したら一覧から消す。
// 重大（critical）と深刻（serious）の違反は、一覧に入れて許さない
// （わざと一覧を作り直すときは UPDATE_A11Y_KNOWN=1 npm run test:e2e:ci -- tests/browser/a11y.spec.ts）
const KNOWN = 'tests/fixtures/a11y-known';

/** 違反の 1 つ（規則と、どの要素か）。impact は読むためだけに残す（比べるのは rule と target） */
type Finding = { rule: string; impact: string; target: string };
const keyOf = (f: Finding) => `${f.rule} ${f.target}`;

// 一覧のページは、初めて開いたときのまま見る（SW が動き出す前に来た pageshow でも、初めの案内が出る。tests/browser/offline-status.spec.ts）
const PAGES: { name: string; path: (site: SiteSession) => string; ready: (page: Page) => Promise<void> }[] = [
  {
    name: 'home',
    path: () => '/',
    ready: (page) => expect(page.locator('#offlineMessage')).toContainText('保存状態を確認しました'),
  },
  {
    name: 'course',
    path: (site) => site.course.route,
    ready: (page) => expect(page.locator('#offlineSave')).toBeEnabled(),
  },
  { name: 'not-found', path: () => '/no-such-page/', ready: (page) => expect(page.locator('h1')).toBeVisible() },
  { name: 'offline', path: () => '/offline/', ready: (page) => expect(page.locator('h1').first()).toBeVisible() },
];

for (const p of PAGES) {
  test(`アクセシビリティ（axe）: ${p.name} のページに、一覧に無い新しい違反が無い`, async ({ page, site }) => {
    await page.goto(p.path(site));
    await p.ready(page);
    const result = await new AxeBuilder({ page }).analyze();
    const found: Finding[] = result.violations
      .flatMap((v) => v.nodes.map((n) => ({ rule: v.id, impact: v.impact ?? '', target: n.target.join(' ') })))
      .sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0));
    // 重大（critical）と深刻（serious）は、一覧に入れて許さない（直す）
    expect(
      found.filter((f) => f.impact === 'critical' || f.impact === 'serious'),
      `${p.name} のページに、重大か深刻なアクセシビリティの違反がある`,
    ).toEqual([]);
    const file = path.join(KNOWN, `${p.name}.json`);
    if (process.env.UPDATE_A11Y_KNOWN === '1') {
      mkdirSync(KNOWN, { recursive: true });
      writeFileSync(file, `${JSON.stringify(found, null, 2)}\n`);
      return;
    }
    const known = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Finding[]) : [];
    const allowed = new Set(known.map(keyOf));
    const fresh = found.filter((f) => !allowed.has(keyOf(f)));
    expect(fresh, `${p.name} のページに新しいアクセシビリティの違反がある（直すか、${file} を見直す）`).toEqual([]);
    // 直った違反は、一覧から消すように知らせる（落とさない）
    const now = new Set(found.map(keyOf));
    const fixed = known.filter((f) => !now.has(keyOf(f)));
    if (fixed.length) {
      test
        .info()
        .annotations.push({ type: '直った違反', description: `${file} から消す: ${fixed.map(keyOf).join('・')}` });
    }
  });
}

/** Tab（back なら Shift+Tab）を押して、selector に合う要素にフォーカスが来るまで進む（キーボードだけで届くか） */
async function tabTo(page: Page, selector: string, back = false, limit = 80) {
  for (let i = 0; i < limit; i++) {
    if (await page.evaluate((s) => !!document.activeElement?.matches(s), selector)) return;
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`${back ? 'Shift+Tab' : 'Tab'} を ${limit} 回押しても ${selector} にフォーカスが来ない`);
}
const focusedIs = (page: Page, selector: string) =>
  page.evaluate((s) => !!document.activeElement?.matches(s), selector);

test('キーボードだけで講座のページを使える（本文へ飛ぶ・再生・チャプターとレクチャーの移動・タブ・クイズ）', async ({
  page,
  site,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(site.course.route);
  await expect(page.locator('#offlineMessage')).toContainText('この講座は未保存');
  const video = page.locator('#video');
  // 動画の音を消す（テストの準備。操作はキーボードだけで行う）
  await video.evaluate((v: HTMLVideoElement) => {
    v.muted = true;
  });

  // 本文へ飛ぶリンク: 最初の Tab で出て、Enter で本文（main）へ移る
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip')).toBeFocused();
  await expect(page.locator('.skip')).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();

  // 1 文字のショートカットは、動画を選んでいないときは効かない（字幕の C）
  const cc = page.locator('#ccToggle');
  const ccBefore = await cc.getAttribute('aria-pressed');
  await page.keyboard.press('c');
  await expect(cc).toHaveAttribute('aria-pressed', ccBefore ?? '');

  // 動画を選ぶと、Space で再生と停止、C で字幕、← → で 5 秒
  await tabTo(page, '#video');
  await page.keyboard.press(' ');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true);
  await page.keyboard.press(' ');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await page.keyboard.press('c');
  await expect(cc).not.toHaveAttribute('aria-pressed', ccBefore ?? '');
  await page.keyboard.press('c');
  await expect(cc).toHaveAttribute('aria-pressed', ccBefore ?? '');
  await video.evaluate((v: HTMLVideoElement) => {
    v.currentTime = 0;
  });
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(1);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBe(0);

  // タブ: ← → で隣、End と Home で端へ（教材の無いレクチャーは、教材のタブを飛ばす）。開いたタブにフォーカスが移る
  await tabTo(page, '#tab-overview');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-transcript')).toBeFocused();
  await expect(page.locator('#tab-transcript')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#p-transcript')).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.locator('#tab-quiz')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-overview')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#tab-quiz')).toBeFocused();
  await expect(page.locator('#p-quiz')).toBeVisible();

  // クイズ: 選ぶと、フォーカスが解説へ移る（押したボタンは押せなくなる）
  await tabTo(page, '#quiz .choice');
  await page.keyboard.press('Enter');
  await expect(page.locator('#quiz .explain')).toBeFocused();
  await expect(page.locator('#quiz .explain')).toContainText('正解');
  await expect(page.locator('#quiz .score')).toContainText('1 問中 1 問正解');
  await tabTo(page, '#quizReset');
  await page.keyboard.press('Enter');
  await expect(page.locator('#quiz .choice').first()).toBeFocused();
  await expect(page.locator('#quiz .explain')).toHaveCount(0);

  // チャプター: 概要のタブのチャプターを Enter で、その時刻へ
  await tabTo(page, '#tab-quiz', true);
  await page.keyboard.press('Home');
  await expect(page.locator('#p-overview')).toBeVisible();
  await tabTo(page, '#chapters button[data-k="1"]');
  await page.keyboard.press('Enter');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThanOrEqual(2);
  await video.evaluate((v: HTMLVideoElement) => v.pause());

  // レクチャーの移動: 右の欄のボタンを Enter で開く。再生して進み具合が書き換わっても、フォーカスは同じボタンのまま
  const [first, second] = site.course.lectures;
  await tabTo(page, '.lec[data-i="1"]');
  await page.keyboard.press('Enter');
  await expect(page.locator('.lec[data-i="1"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#nowTitle')).not.toBeEmpty();
  expect(await focusedIs(page, '.lec[data-i="1"]')).toBe(true);
  await video.evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
  });
  // 4 秒ごとの進み具合の保存と、終わりの完了の印の書き換え（前は右の欄を作り直して、フォーカスが消えていた）
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.ended), { timeout: 15000 }).toBe(true);
  await expect(page.locator('.lec[data-i="1"] .ring.done')).toHaveCount(1);
  await page.waitForTimeout(4500);
  expect(await focusedIs(page, '.lec[data-i="1"]')).toBe(true);
  // 動画を選んで N で次のレクチャー（最後のレクチャーなので動かない）、前のレクチャーへは「前」のボタン
  await tabTo(page, '#prevBtn', true);
  await page.keyboard.press('Enter');
  await expect(page.locator('.lec[data-i="0"]')).toHaveAttribute('aria-current', 'true');
  // 先頭のレクチャーでは「前」が押せなくなるので、フォーカスは「次」へ移る
  await expect(page.locator('#nextBtn')).toBeFocused();
  await tabTo(page, '#video', true);
  await page.keyboard.press('n');
  await expect(page.locator('.lec[data-i="1"]')).toHaveAttribute('aria-current', 'true');
  await expect(page).toHaveURL(new RegExp(`#${second.id}$`));
  expect(first.id).not.toBe(second.id);
  expect(errors).toEqual([]);
});
