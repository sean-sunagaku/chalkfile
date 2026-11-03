// 講座のページ（site/template.html）を描く（純粋）。印は 1 回の走査で置き換える（scripts/site/html.ts の fillTemplate）。
// 版の印（scripts/site-version.ts）は入れたまま描く。CSP は、ページに入れる script（画面と offline-client）から先に作る（csp.ts）
import { LANG_INFO, type Lang } from '../../content/i18n';
import type { Course, Theme } from '../../content/types';
import type { CourseText, CourseTextBase } from '../../site/i18n';
import { texts } from '../../site/lib/text';
import { clock } from '../../site/page/format';
import { type CourseTexts, courseCounts, eyebrowOf } from '../../site/page/summary';
import { fontLink, themeCss } from '../site_theme';
import type { SiteConfig } from '../validate';
import { cspHead } from './csp';
import { fillTemplate, type Html, html, inlineScript, joinHtml, raw, styleText } from './html';
import { courseCredits, courseMeta, type LectureModel, plain } from './model';
import { type AppParts, type CoursesIn, favicon, headMeta, langNav, textOf } from './parts';

export type CoursePageInput = {
  /** site/template.html の中身（画面の script は __PAGE_SCRIPT__ の所に入れる） */
  template: string;
  /** 講座のページの画面（site/course-page.ts を bundle したもの） */
  pageScript: string;
  /** offline-client.ts を bundle したもの（保存機能の部品の script と同じ） */
  offlineClient: string;
  config: SiteConfig;
  /** サイトの URL（/ で終える） */
  base: string;
  langs: readonly Lang[];
  coursesIn: CoursesIn;
  lang: Lang;
  /** 講座のページの決まった文字（site/i18n の courseText） */
  T: CourseText;
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

/** 外のページへのリンクの印（画面の site/course-page.ts の見出しの横のリンクと同じ形） */
const OUT_ICON = raw(
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"></path></svg>',
);

/** 見た割合の輪（まだ見ていない形。画面の site/page/curriculum.ts の ring と同じ形）。i はレクチャーの番号 */
const emptyRing = (tt: CourseTexts['tt'], i: number): Html =>
  html`<svg class="ring" viewBox="0 0 24 24" role="img" aria-label="${tt('ringWatched', { p: 0 })}"><circle class="bg" cx="12" cy="12" r="10" fill="none" stroke-width="2.5"></circle><text class="num" x="12" y="15.2" text-anchor="middle">${i + 1}</text></svg>`;

/**
 * JS が無くても読めるように HTML に書く、最初のレクチャー（見出し・要約・注意書き・要点・チャプター）とカリキュラム・本数と長さ・
 * クレジット・注意書き・リンク。形は画面（site/page/overview.ts・curriculum.ts・site/course-page.ts）が描くものと同じにし、
 * 画面は動き出すと、学習の記録に合わせて描き直す（開くレクチャーも、前に開いたものになる）
 */
const staticParts = (p: CoursePageInput, text: CourseTexts) => {
  const { tt } = text;
  const T = p.T;
  const meta = courseMeta(p.course, T, p.config);
  const first = p.lectures[0];
  const counts = courseCounts(text, meta, p.lectures.map((l) => l.duration));
  const sections = meta.sections.map((sec) => {
    const items = p.lectures.map((l, i) => ({ l, i })).filter((x) => x.l.section.no === sec.no);
    return joinHtml(
      [
        html`<div class="sec"><div class="sec-head"><div class="name"><span class="no">SECTION ${sec.no}</span>${sec.title}</div><span class="cnt">0 / ${items.length}</span></div>`,
        ...items.map(
          (x) =>
            html`<button type="button" class="lec" data-i="${x.i}" data-ring="0"${x.i === 0 ? raw(' aria-current="true"') : raw('')}>${emptyRing(tt, x.i)}<span class="ttl">${x.l.title}</span><span class="dur">${clock(x.l.duration)}</span></button>`,
        ),
        ...meta.planned
          .filter((pl) => pl.section === sec.no)
          .map(
            (pl) =>
              html`<div class="lec planned" aria-disabled="true"><svg class="ring" viewBox="0 0 24 24" aria-hidden="true"><circle class="bg" cx="12" cy="12" r="10" fill="none" stroke-width="2.5" stroke-dasharray="3 3"></circle><text class="num" x="12" y="15.2" text-anchor="middle">${pl.no}</text></svg><span class="ttl">${pl.title}</span><span class="soon">${tt('soon', { min: pl.minutes })}</span></div>`,
          ),
        raw('</div>'),
      ],
      '',
    );
  });
  return {
    COURSE_META: html`${counts.courseMeta}`,
    COURSE_NOTE: meta.disclaimer
      ? html`<span class="note" id="courseNote">${meta.disclaimer}</span>`
      : html`<span class="note" id="courseNote" hidden></span>`,
    LINKS: meta.links.length
      ? html`<span class="links" id="links">${meta.links.map((ln) => html`<a href="${ln.url}" target="_blank" rel="noopener noreferrer">${ln.label}${OUT_ICON}</a>`)}</span>`
      : html`<span class="links" id="links" hidden></span>`,
    NOW_EYEBROW: html`${eyebrowOf(T.sep, meta.unitLabel, first)}`,
    NOW_TITLE: html`${first.title}`,
    TAB_DOCS: html`${meta.ui.docs ?? T.tabDocs}`,
    SUMMARY: html`${first.summary}`,
    CAUTION: first.caution
      ? html`<p class="caution" id="caution">${first.caution}</p>`
      : html`<p class="caution" id="caution" hidden></p>`,
    TAKEAWAYS_TITLE: html`${meta.ui.takeaways ?? T.takeaways}`,
    TAKEAWAYS: joinHtml(
      first.takeaways.map((t) => html`<li><span>${t}</span></li>`),
      '',
    ),
    CHAPTERS: joinHtml(
      first.chapters.map(
        (c, k) =>
          html`<li><button type="button" data-t="${c.start}" data-k="${k}"><span class="t">${clock(c.start)}</span><span>${c.heading}</span></button></li>`,
      ),
      '',
    ),
    SEARCH_PH: html`${
      meta.ui.searchHint
        ? tt('searchPhHint', {
            unit: meta.unitLabel === 'CHAPTER' ? T.unitWordChapter : T.unitWordLecture,
            hint: meta.ui.searchHint,
          })
        : T.searchPh
    }`,
    CUR_SUM: html`${counts.curSum}`,
    SECTIONS: joinHtml(sections, ''),
    CREDITS: html`${tt('credits', { voices: courseCredits(p.course, p.lang).join(T.creditsSep), note: meta.sourceNote })}`,
  };
};

/** 講座のページの HTML（版の印は残したまま） */
export const renderCoursePage = (p: CoursePageInput): string => {
  const info = LANG_INFO[p.lang];
  const T = p.T;
  const text = texts<CourseTextBase>(T, info.html);
  const { tt } = text;
  const cid = `${info.path}${p.course.id}`;
  const url = `${p.base}${cid}/`;
  const firstPoster = `${url}media/${p.lectures[0].key}.jpg`;
  const marks = {
    // CSP の script-src は、このページに入れる script（文書の順に、画面・offline-client）のハッシュ
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
    NOTE_AT_ZERO: html`${tt('noteAt', { t: '00:00' })}`,
    PWA_HEAD: p.app.head,
    // site/offline.css（リポジトリのファイル）
    OFFLINE_CSS: raw(p.offlineCss),
    OFFLINE_PANEL: p.app.panel,
    PWA_SCRIPT: p.app.script,
    TITLE: html`${tt('pageTitle', { course: p.course.title, series: p.config.series })}`,
    HEAD_META: headMeta({
      series: p.config.series,
      title: p.course.title,
      description: tt('metaCourse', {
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
    ...staticParts(p, text),
  };
  return fillTemplate(p.template, { marks, text: textOf(T) }, 'site/template.html');
};
