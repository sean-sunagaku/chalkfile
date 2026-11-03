// 無いページ（言語ごとの 404.html。ひな形は site/not-found.html）を描く（純粋）。Workers の静的 assets は、無いパスに、そのパスから
// いちばん近いフォルダの 404.html を 404 で返す（wrangler.jsonc の not_found_handling: 404-page）。訳の言語は <言語>/404.html に置くので、
// /en/ の下の無いページは英語の案内になる。手元の配信（scripts/site/serve-files.ts）も同じ選び方をする
import { LANG_INFO, type Lang } from '../../content/i18n';
import { type JaLocale, LOCALES } from '../../site/i18n';
import { texts } from '../../site/lib/text';
import { cspHead } from './csp';
import { fillTemplate, html } from './html';
import { textOf } from './parts';

export const renderNotFound = (o: {
  /** site/not-found.html の中身 */
  template: string;
  lang: Lang;
  /** site/config.json の series（題に入れる） */
  series: string;
  /** サイトの URL の path（/ で終える。一覧のページへのリンクの頭） */
  basePath: string;
}): string => {
  const L = LOCALES[o.lang].notFound;
  const info = LANG_INFO[o.lang];
  const { tt } = texts<JaLocale['notFound']>(L, info.html);
  return fillTemplate(
    o.template,
    {
      marks: {
        LANG: html`${info.html}`,
        // 動く script は www の移動だけ（csp.ts）
        CSP: cspHead([]),
        TITLE: html`${tt('title', { series: o.series })}`,
        HOME: html`${o.basePath}${info.path}`,
      },
      text: textOf(L),
    },
    'site/not-found.html',
  );
};

/** 言語の 404.html の置き場所（サイトの最上位からの場所。日本語は最上位） */
export const notFoundFile = (lang: Lang) => `${LANG_INFO[lang].path}404.html`;
