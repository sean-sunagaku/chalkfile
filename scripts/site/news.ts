// 「新しい版」の案内に出す、何が変わったか（正本は site/news.ts）。講座ごとの保存用の教材情報（offline-manifest.json の news）に入れるものを選び、
// お知らせの書き方の誤りを見つける（組み立てが止める。テストは tests/unit/site-news.test.ts）
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Lang } from '../../content/i18n';
import { NEWS_MAX, type SiteNews } from '../../site/news';
import type { CourseNews } from '../../site/offline-shared';

/** 講座に当たるお知らせ（新しいものから NEWS_MAX 件。文は講座の言語）。courseId は言語を付けない講座の ID */
export const newsFor = (news: readonly SiteNews[], courseId: string, lang: Lang): CourseNews[] =>
  news
    .filter((n) => !n.courses || n.courses.includes(courseId))
    .slice(0, NEWS_MAX)
    .map((n) => ({ date: n.date, text: n.text[lang] }));

/**
 * お知らせの誤り: 日付の形と並び（新しいものが先）・その回のお知らせの文書（docs/history/ の、名前の頭が同じ日付のもの）・
 * 公開する言語の文（空でなく、1 文で 200 字まで）・知らない講座
 */
export const newsProblems = (
  news: readonly SiteNews[],
  o: { root: string; langs: readonly Lang[]; courses: readonly string[] },
): string[] => {
  const problems: string[] = [];
  const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
  news.forEach((n, i) => {
    const where = `site/news.ts の ${i + 1} 件目（${n.date}）`;
    if (!isDate(n.date)) problems.push(`${where}: 日付は YYYY-MM-DD で書く`);
    const before = news[i - 1];
    if (before && isDate(before.date) && isDate(n.date) && before.date < n.date) {
      problems.push(`${where}: 新しいものを先に書く（前の ${before.date} より新しい）`);
    }
    const name = path.basename(n.history);
    if (!n.history.startsWith('docs/history/') || !name.startsWith(`${n.date}-`) || !name.endsWith('.md')) {
      problems.push(`${where}: history は docs/history/${n.date}-….md（名前の頭は同じ日付）`);
    } else if (!existsSync(path.join(o.root, n.history))) problems.push(`${where}: お知らせの文書が無い: ${n.history}`);
    for (const lang of o.langs) {
      const text = n.text[lang]?.trim() ?? '';
      if (!text) problems.push(`${where}: ${lang} の文が無い`);
      else if (text.length > 200)
        problems.push(`${where}: ${lang} の文が長い（200 字まで。詳しいことは ${n.history} に書く）`);
    }
    for (const id of n.courses ?? []) if (!o.courses.includes(id)) problems.push(`${where}: 知らない講座: ${id}`);
  });
  return problems;
};
