// 講座のページ（site/template.html）を描く（純粋）。印は 1 回の走査で置き換える（scripts/site/html.ts の fillTemplate）。
// 版の印（scripts/site-version.ts）は入れたまま描く。CSP は、ページに入れる script（本体と offline-client）から先に作る（csp.ts）
import { LANG_INFO, type Lang } from '../../content/i18n';
import type { Course, Theme } from '../../content/types';
import type { SiteText } from '../../site/i18n';
import { fill } from '../../site/lib/text';
import { fontLink, themeCss } from '../site_theme';
import type { SiteConfig } from '../validate';
import { cspHead } from './csp';
import { fillTemplate, type Html, html, inlineScript, raw, styleText } from './html';
import { type LectureModel, plain } from './model';
import { type AppParts, type CoursesIn, favicon, headMeta, langNav, textOf } from './parts';

export type CoursePageInput = {
  /** site/template.html の中身から、ページの本体の script を __PAGE_SCRIPT__ にしたもの（csp.ts の splitPageScript） */
  template: string;
  /** ページの本体の script（csp.ts の splitPageScript が取り出したもの） */
  pageScript: string;
  /** offline-client.ts を bundle したもの（保存機能の部品の script と同じ） */
  offlineClient: string;
  config: SiteConfig;
  /** サイトの URL（/ で終える） */
  base: string;
  langs: readonly Lang[];
  coursesIn: CoursesIn;
  lang: Lang;
  T: SiteText;
  course: Course;
  theme: Theme;
  /** ページから見たサイトの最上位（日本語の講座は ../、訳の講座は ../../） */
  root: string;
  lectures: LectureModel[];
  /** 動画の合計の長さ（分） */
  minutes: number;
  /** 保存機能の部品（parts.ts の appParts） */
  app: AppParts;
  /** site/offline.css の中身 */
  offlineCss: string;
  /** ページの中の JSON（model.ts の courseJson） */
  json: Html;
};

/** 根拠の札の説明の続き。{id} の所（最初の 1 つ）に、節 ID の見本を入れる */
const evidenceHintTail = (text: string): Html => {
  const at = text.indexOf('{id}');
  return at < 0
    ? html`${text}`
    : html`${text.slice(0, at)}<span class="mono">xx-01-s01</span>${text.slice(at + '{id}'.length)}`;
};

/** 講座のページの HTML（版の印は残したまま） */
export const renderCoursePage = (p: CoursePageInput): string => {
  const info = LANG_INFO[p.lang];
  const T = p.T;
  const cid = `${info.path}${p.course.id}`;
  const url = `${p.base}${cid}/`;
  const firstPoster = `${url}media/${p.lectures[0].key}.jpg`;
  const marks = {
    // CSP の script-src は、このページに入れる script（文書の順に、本体・offline-client）のハッシュ
    CSP: cspHead([p.pageScript, p.offlineClient]),
    PAGE_SCRIPT: inlineScript(p.pageScript),
    LANG: html`${info.html}`,
    HOME: html`../`,
    LANG_NAV: langNav({
      langs: p.langs,
      coursesIn: p.coursesIn,
      lang: p.lang,
      root: p.root,
      label: T.langNav,
      courseId: p.course.id,
    }),
    EV_HINT_TAIL: evidenceHintTail(T.evHintTail),
    NOTE_AT_ZERO: html`${fill(T.noteAt, { t: '00:00' })}`,
    PWA_HEAD: p.app.head,
    // site/offline.css（リポジトリのファイル）
    OFFLINE_CSS: raw(p.offlineCss),
    OFFLINE_PANEL: p.app.panel,
    PWA_SCRIPT: p.app.script,
    TITLE: html`${fill(T.pageTitle, { course: p.course.title, series: p.config.series })}`,
    HEAD_META: headMeta({
      series: p.config.series,
      title: p.course.title,
      description: fill(T.metaCourse, {
        headline: plain(p.course.headline),
        n: p.lectures.length,
        min: Math.round(p.minutes),
        extra: p.lectures.some((l) => l.material) ? T.metaExtra : '',
      }),
      url,
      image: firstPoster,
      icon: favicon(p.theme.color.ink, p.theme.color.accent),
      lang: p.lang,
      alternates: p.langs
        .filter((l) => p.coursesIn(l).some((c) => c.id === p.course.id))
        .map((l) => ({ lang: l, url: `${p.base}${LANG_INFO[l].path}${p.course.id}/` })),
    }),
    // 書体の読み込み（scripts/site_theme.ts が作る。URL の & はそのまま）
    FONT_LINK: raw(fontLink(p.theme, p.lang)),
    THEME_CSS: styleText(themeCss(p.theme, p.lang)),
    SERIES: html`${p.config.series}`,
    BRAND_SUB: html`${p.course.title}`,
    HEADLINE: html`${plain(p.course.headline)}`,
    DOCS_NOTE: html`${p.course.docsNote}`,
    COURSE_JSON: p.json,
  };
  return fillTemplate(p.template, { marks, text: textOf(T) }, 'site/template.html');
};
