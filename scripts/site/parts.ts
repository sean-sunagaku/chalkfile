// 講座のページと一覧のページで共通の部品（純粋）: 決まった文字の引き方・検索と SNS の <head>・言語の切り替え・
// 保存機能（PWA）の <head>・パネル・script・ファビコン。HTML は scripts/site/html.ts の html`…` で作る（エスケープが既定）
import { LANG_INFO, type Lang } from '../../content/i18n';
import type { Course } from '../../content/types';
import type { Locale } from '../../site/i18n';
import { cssColor, fillTemplate, type Html, html, inlineScript, joinHtml, jsonHtml, raw } from './html';

/**
 * テンプレートの {{key}}・{{key.name}} に入れる、その言語の決まった文字（表 table の key、. で区切ると中の表の name）。
 * 無いキーと、文字でないもの（表・数で形の変わる文字）は undefined（fillTemplate が止める）
 */
export const textOf =
  (table: object) =>
  (key: string): string | undefined => {
    let value: unknown = table;
    for (const part of key.split('.')) {
      if (typeof value !== 'object' || value === null || !Object.hasOwn(value, part)) return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    return typeof value === 'string' ? value : undefined;
  };

/** ページの言語の、保存機能の画面（offline-client.ts）に渡す文字 */
const LOCALE: Record<Lang, string> = { ja: 'ja-JP', en: 'en-US', zh: 'zh-CN' };
const OG_LOCALE: Record<Lang, string> = { ja: 'ja_JP', en: 'en_US', zh: 'zh_CN' };

/** テーマの文字の色とアクセントで描く、小さな黒板のファビコン（data: の SVG） */
export const favicon = (ink: string, accent: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="3" y="7" width="26" height="18" rx="5" fill="${cssColor(ink)}"/><rect x="3" y="20" width="26" height="5" rx="2" fill="${cssColor(accent)}"/></svg>`,
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
}): Html =>
  joinHtml(
    [
      html`<meta name="description" content="${h.description}">`,
      html`<link rel="canonical" href="${h.url}">`,
      ...h.alternates.map((a) => html`<link rel="alternate" hreflang="${LANG_INFO[a.lang].html}" href="${a.url}">`),
      ...h.alternates
        .filter((a) => a.lang === 'ja')
        .map((a) => html`<link rel="alternate" hreflang="x-default" href="${a.url}">`),
      html`<link rel="icon" href="${h.icon}">`,
      html`<meta property="og:type" content="website">`,
      html`<meta property="og:site_name" content="${h.series}">`,
      html`<meta property="og:title" content="${h.title}">`,
      html`<meta property="og:description" content="${h.description}">`,
      html`<meta property="og:url" content="${h.url}">`,
      html`<meta property="og:locale" content="${OG_LOCALE[h.lang]}">`,
      ...(h.image ? [html`<meta property="og:image" content="${h.image}">`] : []),
      html`<meta name="twitter:card" content="${h.image ? 'summary_large_image' : 'summary'}">`,
    ],
    '\n',
  );

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
}): Html => {
  if (o.langs.length < 2) return raw('');
  const links = o.langs.map((l) => {
    const has = o.courseId && o.coursesIn(l).some((c) => c.id === o.courseId);
    const href = `${o.root}${LANG_INFO[l].path}${has ? `${o.courseId}/` : ''}`;
    const current = l === o.lang ? html` aria-current="page"` : raw('');
    return html`<a href="${href}" hreflang="${LANG_INFO[l].html}" lang="${LANG_INFO[l].html}"${current}>${LANG_INFO[l].label}</a>`;
  });
  return html`<nav class="langs" aria-label="${o.label}">${links}</nav>`;
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
  /** 言語ごとの決まった文字（site/i18n の LOCALES。保存の欄は panel と client、保存の画面は client を使う） */
  text: Readonly<Record<Lang, Locale>>;
};

/** 保存機能の部品（ページのテンプレートの __PWA_HEAD__・__OFFLINE_PANEL__・__PWA_SCRIPT__） */
export type AppParts = { head: Html; panel: Html; script: Html };

/**
 * 保存機能の <head>（manifest・アイコン・色）・保存のパネル・script（ページのデータの JSON と offline-client）。
 * course は講座のページだけ（一覧のページは保存した講座の一覧を開いて出す）
 */
export const appParts = (
  ctx: AppContext,
  lang: Lang,
  root: string,
  course?: { id: string; title: string; pageVersion: string },
): AppParts => ({
  head: html`<link rel="manifest" href="${root}manifest.webmanifest"><link rel="apple-touch-icon" href="${root}icons/icon-180.png"><meta name="theme-color" content="${cssColor(ctx.themeColor)}"><meta name="apple-mobile-web-app-capable" content="yes">`,
  panel: raw(
    fillTemplate(
      ctx.offlinePanel,
      {
        marks: { COURSE_HIDDEN: html`${course ? '' : 'hidden'}`, LIBRARY_OPEN: html`${course ? '' : 'open'}` },
        text: textOf({ ...ctx.text[lang].client, ...ctx.text[lang].panel }),
      },
      'site/offline-panel.html',
    ),
  ),
  script: html`<script id="pwa-data" type="application/json">${jsonHtml({
    root,
    course,
    courses: ctx.coursesIn(lang).map((c) => ({ id: `${LANG_INFO[lang].path}${c.id}`, title: c.title })),
    lang,
    locale: LOCALE[lang],
    text: ctx.text[lang].client,
  })}</script>${inlineScript(ctx.offlineClient)}`,
});
