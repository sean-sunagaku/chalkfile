import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { SiteSession } from '../e2e/site';
import { expect, openWithActiveWorker, test } from './fixtures';

// アクセシビリティの検査（axe-core の既定の規則）。合成の講座（project ci）のページで見る（本物の講座は中身が増えると結果が変わる）。
// 今ある違反は tests/fixtures/a11y-known/<ページ>.json に並べて許し、新しい違反が出たら落ちる。直したら一覧から消す
// （わざと一覧を作り直すときは UPDATE_A11Y_KNOWN=1 npm run test:e2e:ci -- tests/browser/a11y.spec.ts）
const KNOWN = 'tests/fixtures/a11y-known';

/** 違反の 1 つ（規則と、どの要素か）。impact は読むためだけに残す（比べるのは rule と target） */
type Finding = { rule: string; impact: string; target: string };
const keyOf = (f: Finding) => `${f.rule} ${f.target}`;

/** open を書いたページは、それで開く（既定は page.goto） */
const PAGES: {
  name: string;
  path: (site: SiteSession) => string;
  open?: (page: Page, url: string) => Promise<void>;
  ready: (page: Page) => Promise<void>;
}[] = [
  {
    name: 'home',
    path: () => '/',
    open: openWithActiveWorker,
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
    await (p.open ?? ((pg: Page, url: string) => pg.goto(url).then(() => undefined)))(page, p.path(site));
    await p.ready(page);
    const result = await new AxeBuilder({ page }).analyze();
    const found: Finding[] = result.violations
      .flatMap((v) => v.nodes.map((n) => ({ rule: v.id, impact: v.impact ?? '', target: n.target.join(' ') })))
      .sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0));
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
