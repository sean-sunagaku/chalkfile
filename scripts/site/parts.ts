// 講座のページと一覧のページで共通の部品（純粋）: エスケープ・決まった文字の差し込み・検索と SNS の <head>・言語の切り替え・
// 保存機能（PWA）の <head>・パネル・script・ファビコン
import { LANG_INFO, type Lang } from '../../content/i18n';
import type { Course } from '../../content/types';
import type { SiteText } from '../../site/i18n';

/** HTML の文字と属性の値に入れるときのエスケープ（& < > "） */
export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** テンプレートの {{key}} を、その言語の決まった文字（エスケープ済み）にする */
export const fillText = (html: string, T: SiteText) =>
  html.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in T ? esc(T[k as keyof SiteText]) : m));

/** ページの言語の、保存機能の画面（offline-client.ts）に渡す文字 */
const LOCALE: Record<Lang, string> = { ja: 'ja-JP', en: 'en-US', zh: 'zh-CN' };
const OG_LOCALE: Record<Lang, string> = { ja: 'ja_JP', en: 'en_US', zh: 'zh_CN' };

/** テーマの文字の色とアクセントで描く、小さな黒板のファビコン（data: の SVG） */
export const favicon = (ink: string, accent: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="3" y="7" width="26" height="18" rx="5" fill="${ink}"/><rect x="3" y="20" width="26" height="5" rx="2" fill="${accent}"/></svg>`,
  );

/** 検索と SNS の共有で使う <head> の中身。alternates は、同じページのほかの言語（hreflang） */
export const headMeta = (h: {
  series: string;
  title: string;
  description: string;
  url: string;
  image?: string;
  icon: string;
  lang: Lang;
  alternates: { lang: Lang; url: string }[];
}) =>
  [
    `<meta name="description" content="${esc(h.description)}">`,
    `<link rel="canonical" href="${esc(h.url)}">`,
    ...h.alternates.map((a) => `<link rel="alternate" hreflang="${LANG_INFO[a.lang].html}" href="${esc(a.url)}">`),
    ...h.alternates
      .filter((a) => a.lang === 'ja')
      .map((a) => `<link rel="alternate" hreflang="x-default" href="${esc(a.url)}">`),
    `<link rel="icon" href="${h.icon}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${esc(h.series)}">`,
    `<meta property="og:title" content="${esc(h.title)}">`,
    `<meta property="og:description" content="${esc(h.description)}">`,
    `<meta property="og:url" content="${esc(h.url)}">`,
    `<meta property="og:locale" content="${OG_LOCALE[h.lang]}">`,
    h.image ? `<meta property="og:image" content="${esc(h.image)}">` : '',
    `<meta name="twitter:card" content="${h.image ? 'summary_large_image' : 'summary'}">`,
  ]
    .filter(Boolean)
    .join('\n');

/** 言語ごとの講座（日本語は全部、訳の言語は訳のある講座だけ） */
export type CoursesIn = (lang: Lang) => readonly Course[];

/** 言語の切り替え（今の言語に aria-current）。courseId があれば、その講座の訳へ。訳が無い言語は、その言語の一覧へ。言語が 1 つなら出さない */
export const langNav = (o: {
  langs: readonly Lang[];
  coursesIn: CoursesIn;
  lang: Lang;
  root: string;
  label: string;
  courseId?: string;
}) => {
  if (o.langs.length < 2) return '';
  return `<nav class="langs" aria-label="${esc(o.label)}">${o.langs
    .map((l) => {
      const has = o.courseId && o.coursesIn(l).some((c) => c.id === o.courseId);
      const href = `${o.root}${LANG_INFO[l].path}${has ? `${o.courseId}/` : ''}`;
      return `<a href="${esc(href)}" hreflang="${LANG_INFO[l].html}" lang="${LANG_INFO[l].html}"${l === o.lang ? ' aria-current="page"' : ''}>${esc(LANG_INFO[l].label)}</a>`;
    })
    .join('')}</nav>`;
};

/** 保存機能（PWA）の部品を作るときに、ページの種類によらず同じもの */
export type AppContext = {
  /** site/offline-panel.html の中身 */
  offlinePanel: string;
  /** offline-client.ts を bundle したもの */
  offlineClient: string;
  /** アプリの色（既定のテーマの地の色） */
  themeColor: string;
  coursesIn: CoursesIn;
  text: Record<Lang, SiteText>;
};

/**
 * 保存機能の <head>（manifest・アイコン・色）・保存のパネル・script（ページのデータの JSON と offline-client）。
 * course は講座のページだけ（一覧のページは保存した講座の一覧を開いて出す）
 */
export const appParts = (
  ctx: AppContext,
  lang: Lang,
  root: string,
  course?: { id: string; title: string; pageVersion: string },
) => ({
  head: `<link rel="manifest" href="${root}manifest.webmanifest"><link rel="apple-touch-icon" href="${root}icons/icon-180.png"><meta name="theme-color" content="${ctx.themeColor}"><meta name="apple-mobile-web-app-capable" content="yes">`,
  panel: fillText(
    ctx.offlinePanel
      .replace('__COURSE_HIDDEN__', course ? '' : 'hidden')
      .replace('__LIBRARY_OPEN__', course ? '' : 'open'),
    ctx.text[lang],
  ),
  script: `<script id="pwa-data" type="application/json">${JSON.stringify({
    root,
    course,
    courses: ctx.coursesIn(lang).map((c) => ({ id: `${LANG_INFO[lang].path}${c.id}`, title: c.title })),
    lang,
    locale: LOCALE[lang],
    text: ctx.text[lang],
  }).replace(/</g, '\\u003c')}</script><script>${ctx.offlineClient}</script>`,
});
