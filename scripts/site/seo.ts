// 検索のための公開物（サイトの最上位に置く）: sitemap.xml（検索に出すページの一覧。一覧のページと講座のページを、出す言語の分だけ）と
// robots.txt（sitemap の場所と、検索に出さない所）。ページの <link rel="alternate" hreflang> と同じく、同じページのほかの言語も書く
import { LANG_INFO, type Lang } from '../../content/i18n';
import { esc } from './html';

/** 検索に出すページ 1 つ。url は絶対 URL、alternates は同じページの出す言語の全部（そのページの言語も入れる） */
export type SitemapPage = { url: string; alternates: readonly { lang: Lang; url: string }[] };

/** sitemap.xml の中身。出す言語が 1 つのときは、ほかの言語の行（xhtml:link）を書かない */
export const sitemapXml = (pages: readonly SitemapPage[]): string => {
  const multi = pages.some((p) => p.alternates.length > 1);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${multi ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : ''}>`,
  ];
  for (const p of pages) {
    lines.push('  <url>', `    <loc>${esc(p.url)}</loc>`);
    if (p.alternates.length > 1) {
      for (const a of p.alternates)
        lines.push(`    <xhtml:link rel="alternate" hreflang="${LANG_INFO[a.lang].html}" href="${esc(a.url)}"/>`);
      const ja = p.alternates.find((a) => a.lang === 'ja');
      if (ja) lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(ja.url)}"/>`);
    }
    lines.push('  </url>');
  }
  lines.push('</urlset>', '');
  return lines.join('\n');
};

/**
 * robots.txt の中身。動画（/media/。Worker が Releases から中継し、無料の枠を使う）と、通信できないときに SW が出すページ（offline/）は、
 * 検索で取りに来させない
 */
export const robotsTxt = (base: string): string => {
  const at = new URL(base).pathname;
  return [
    'User-agent: *',
    `Disallow: ${at}media/`,
    `Disallow: ${at}offline/`,
    '',
    `Sitemap: ${base}sitemap.xml`,
    '',
  ].join('\n');
};
