// 「新しい版」の案内に出す、何が変わったか（site/news.ts と scripts/site/news.ts）
import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import { LANGS } from '../../content/i18n';
import { newsFor, newsProblems } from '../../scripts/site/news';
import { NEWS_MAX, SITE_NEWS, type SiteNews } from '../../site/news';

const ROOT = path.resolve(import.meta.dir, '../..');
const entry = (over: Partial<SiteNews> = {}): SiteNews => ({
  date: '2026-11-04',
  history: 'docs/history/2026-11-04-course-page.md',
  text: { ja: '日本語の文', en: 'English', zh: '中文' },
  ...over,
});

describe('お知らせ（site/news.ts）', () => {
  test('今のお知らせは、全部の言語の文と、その回のお知らせの文書を持つ', () => {
    expect(SITE_NEWS.length).toBeGreaterThan(0);
    expect(newsProblems(SITE_NEWS, { root: ROOT, langs: LANGS, courses: [] })).toEqual([]);
  });

  test('講座に当たるものを、新しいものから NEWS_MAX 件、講座の言語の文で選ぶ', () => {
    const news = [
      entry({ date: '2026-11-09', text: { ja: 'a', en: 'A', zh: 'A' }, courses: ['x'] }),
      entry({ date: '2026-11-08', text: { ja: 'b', en: 'B', zh: 'B' } }),
      entry({ date: '2026-11-07', text: { ja: 'c', en: 'C', zh: 'C' } }),
      entry({ date: '2026-11-06', text: { ja: 'd', en: 'D', zh: 'D' } }),
      entry({ date: '2026-11-05', text: { ja: 'e', en: 'E', zh: 'E' } }),
    ];
    expect(newsFor(news, 'y', 'ja').map((n) => n.text)).toEqual(['b', 'c', 'd'].slice(0, NEWS_MAX));
    expect(newsFor(news, 'x', 'en')).toEqual([
      { date: '2026-11-09', text: 'A' },
      { date: '2026-11-08', text: 'B' },
      { date: '2026-11-07', text: 'C' },
    ]);
  });

  test('日付の形と並び・お知らせの文書・文の無い言語と長い文・知らない講座を見つける', () => {
    const problems = newsProblems(
      [
        entry({ date: '2026-11-03', history: 'docs/history/2026-11-03-service-worker-update.md' }),
        entry({ date: '2026-11-04' }),
        entry({ date: '11/04', history: 'docs/history/11-04.md' }),
        entry({ history: 'docs/history/2026-11-04-none.md' }),
        entry({ text: { ja: '', en: 'x'.repeat(201), zh: '中文' }, courses: ['no-such-course'] }),
      ],
      { root: ROOT, langs: LANGS, courses: ['stripe-billing'] },
    );
    expect(problems).toEqual([
      'site/news.ts の 2 件目（2026-11-04）: 新しいものを先に書く（前の 2026-11-03 より新しい）',
      'site/news.ts の 3 件目（11/04）: 日付は YYYY-MM-DD で書く',
      'site/news.ts の 3 件目（11/04）: history は docs/history/11/04-….md（名前の頭は同じ日付）',
      'site/news.ts の 4 件目（2026-11-04）: お知らせの文書が無い: docs/history/2026-11-04-none.md',
      'site/news.ts の 5 件目（2026-11-04）: ja の文が無い',
      'site/news.ts の 5 件目（2026-11-04）: en の文が長い（200 字まで。詳しいことは docs/history/2026-11-04-course-page.md に書く）',
      'site/news.ts の 5 件目（2026-11-04）: 知らない講座: no-such-course',
    ]);
  });
});
