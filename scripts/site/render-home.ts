// 一覧のページ（site/home.html）を描く（純粋）。講座のカード・まだ訳していない講座・テーマの一覧・最初の画面の台本の抜き出し。
// 印は 1 回の走査で置き換える（scripts/site/html.ts の fillTemplate）。CSP は、ページに入れる script（offline-client）から先に作る（csp.ts）
import type { HeroSnippet } from '../../content/course-module';
import { LANG_INFO, type Lang, videoKey } from '../../content/i18n';
import type { Course, Theme } from '../../content/types';
import type { HomeText, HomeTextBase } from '../../site/i18n';
import { texts } from '../../site/lib/text';
import { fontLink, themeCss } from '../site_theme';
import type { SiteConfig } from '../validate';
import { readableOn } from './contrast';
import { cspHead } from './csp';
import { cssColor, esc, fillTemplate, type Html, html, joinHtml, raw, styleText } from './html';
import { plain } from './model';
import { type AppParts, type CoursesIn, favicon, headMeta, langNav, textOf } from './parts';

/**
 * 一覧ページから見た、講座の最初の動画のポスター（root はその一覧ページから見たサイトの最上位、version は ?v= に付ける版。
 * ポスターは ?v= の付いた資源として長くキャッシュさせるので、いつも版を付けて読む。scripts/site/headers.ts）
 */
export const homePosterOf = (c: Course, root: string, version: string) => {
  const l = (c.lang ?? 'ja') as Lang;
  const key = videoKey(c.lectures[0]!.id, l);
  return `${root}${LANG_INFO[l].path}${c.id}/media/${key}.jpg?v=${version}`;
};

/** 文字列・キー・数・省略記号を 1 回の走査で塗る（エスケープした行を塗る。塗った span の中をもう一度塗らない） */
const highlightTs = (line: string, S: Theme['syntax']): Html =>
  raw(
    esc(line).replace(
      /('[^']*')|\b([a-z][A-Za-z]*)(?=:)|\b(\d+)\b|(…)/g,
      (m, str, key, num) =>
        `<span style="color:${cssColor(str ? S.string : key ? S.fn : num ? S.number : S.comment)}">${m}</span>`,
    ),
  );

export type HomePageInput = {
  /** site/home.html の中身 */
  home: string;
  config: SiteConfig;
  /** サイトの URL（/ で終える） */
  base: string;
  langs: readonly Lang[];
  coursesIn: CoursesIn;
  lang: Lang;
  /** 一覧のページの決まった文字（site/i18n の homeText） */
  T: HomeText;
  /** 一覧のページのテーマ（既定のテーマ） */
  brand: Theme;
  /** 並べるテーマ（content/themes.ts の THEMES） */
  themes: readonly Theme[];
  /** 講座のテーマ（content/themes.ts の themeOf） */
  themeOf: (id?: Course['theme']) => Theme;
  /** テーマの見本の画像（site/assets/themes/<id>.jpg）があるか */
  hasThemeImage: (id: string) => boolean;
  /** テーマの紹介文（その言語の site/i18n の themes） */
  themeSummary: (theme: Theme) => string;
  /** 講座の動画の合計の長さ（分） */
  minutesOf: (course: Course) => number;
  /** 一覧のページのクレジット（model.ts の homeCredits） */
  credits: readonly string[];
  /** 講座の縮小画像の ?v=（その講座のページの版。build.ts の posterVersion） */
  posterVersion: (course: Course) => string;
  hero: HeroSnippet;
  /** 保存機能の部品（parts.ts の appParts） */
  app: AppParts;
  /** offline-client.ts を bundle したもの（保存機能の部品の script と同じ） */
  offlineClient: string;
  /** site/offline.css の中身 */
  offlineCss: string;
};

/** 講座のカード。href・画像はその一覧ページからの場所。tags は事実の札に足すもの（言語など） */
const courseCard = (
  p: HomePageInput,
  c: Course,
  t: Theme,
  o: { href: string; poster: string; tags: string[] },
): Html => {
  const T = p.T;
  const { tt, tn } = texts<HomeTextBase>(T, LANG_INFO[p.lang].html);
  const minutes = p.minutesOf(c);
  // テーマの色は形を確かめてから style に入れる（エスケープもする）
  const style = `--card-grad: linear-gradient(100deg, ${t.gradient.map(cssColor).join(', ')}); --card-soft: ${cssColor(t.color.surface2)}; --card-ink: ${cssColor(readableOn(t.tones.violet, [t.color.surface2], t.color.ink))}`;
  const count =
    c.unitLabel === 'CHAPTER'
      ? `${tn('chapterCount', c.lectures.length)}${c.syllabus ? tt('cardPlanned', { n: c.syllabus.chapters.length }) : ''}`
      : tn('lectureCount', c.lectures.length);
  // 一覧の言語と違う講座には、講座の言語を付ける（訳の一覧に並べる日本語の講座は ja）
  const langAttr =
    c.lang && c.lang !== p.lang
      ? html` lang="${LANG_INFO[c.lang].html}"`
      : !c.lang && p.lang !== 'ja'
        ? html` lang="ja"`
        : raw('');
  return joinHtml(
    [
      html`<a class="course" href="${o.href}" style="${style}"${langAttr}>`,
      html`  <div class="poster"><img src="${o.poster}" alt="" width="1280" height="720" loading="lazy"></div>`,
      html`  <div class="body">`,
      html`    <h3>${c.title}</h3>`,
      html`    <p>${plain(c.headline)}</p>`,
      html`    <ul class="facts"><li>${count}</li><li>${tt('cardMinutes', { min: Math.round(minutes) })}</li><li class="is-theme">${tt('cardTheme', { theme: t.label })}</li>${o.tags.map((g) => html`<li>${g}</li>`)}</ul>`,
      html`    <span class="go">${T.cardOpen}</span>`,
      html`  </div>`,
      html`</a>`,
    ],
    '\n',
  );
};

/** テーマの一覧の 1 つ（見本の画像・名前・色の見本・紹介文） */
const themeCard = (p: HomePageInput, t: Theme, root: string): Html => {
  const { tt } = texts<HomeTextBase>(p.T, LANG_INFO[p.lang].html);
  const sw = [t.color.bg, t.color.ink, t.color.accent, t.tones.pink, t.tones.cyan, t.tones.mint];
  return joinHtml(
    [
      html`<article class="theme">`,
      ...(p.hasThemeImage(t.id)
        ? [
            html`  <img src="${root}assets/themes/${t.id}.jpg" alt="${tt('themeAlt', { theme: t.label })}" width="960" height="540" loading="lazy">`,
          ]
        : []),
      html`  <div class="body">`,
      html`    <h3>${t.label} <code>theme: '${t.id}'</code></h3>`,
      html`    <div class="swatches" aria-hidden="true">${sw.map((c) => html`<span style="background:${cssColor(c)}"></span>`)}</div>`,
      html`    <p>${p.themeSummary(t)}</p>`,
      html`  </div>`,
      html`</article>`,
    ],
    '\n',
  );
};

/** 一覧のページの HTML */
export const renderHomePage = (p: HomePageInput): string => {
  const T = p.T;
  const lang = p.lang;
  const { tt } = texts<HomeTextBase>(T, LANG_INFO[lang].html);
  const info = LANG_INFO[lang];
  // 一覧ページから見たサイトの最上位（日本語は ./、訳は ../）
  const root = lang === 'ja' ? './' : '../';
  const courses = p.coursesIn(lang);
  const all = p.coursesIn('ja');
  const cards = courses.map((c) => {
    // 日本語の一覧では、訳のある講座に言語の札を付ける
    const tags =
      lang === 'ja'
        ? p.langs.filter((l) => l !== 'ja' && p.coursesIn(l).some((x) => x.id === c.id)).map((l) => LANG_INFO[l].label)
        : [];
    return courseCard(p, c, p.themeOf(c.theme), {
      href: `${c.id}/`,
      poster: homePosterOf(c, root, p.posterVersion(c)),
      tags: tags.length ? [tags.join('・')] : [],
    });
  });
  // 訳の一覧では、まだ訳していない講座を「日本語だけ」として並べる
  const others = lang === 'ja' ? [] : all.filter((c) => !courses.some((x) => x.id === c.id));
  const otherSection = others.length
    ? joinHtml(
        [
          html`    <section id="more-courses" aria-labelledby="more-title">`,
          html`      <h2 id="more-title">${T.homeOtherTitle}</h2>`,
          html`      <p class="lede">${T.homeOtherLede}</p>`,
          html`      <div class="courses">`,
          joinHtml(
            others.map((c) =>
              courseCard(p, c, p.themeOf(c.theme), {
                href: `${root}${c.id}/`,
                poster: homePosterOf(c, root, p.posterVersion(c)),
                tags: [T.cardLang],
              }),
            ),
            '\n',
          ),
          html`      </div>`,
          html`    </section>`,
        ],
        '\n',
      )
    : raw('');
  const url = `${p.base}${info.path}`;
  const marks = {
    // CSP の script-src は、このページに入れる script（offline-client）のハッシュ
    CSP: cspHead([p.offlineClient]),
    LANG: html`${info.html}`,
    LANG_NAV: langNav({ langs: p.langs, coursesIn: p.coursesIn, lang, root, label: T.langNav }),
    PWA_HEAD: p.app.head,
    // site/offline.css（リポジトリのファイル）
    OFFLINE_CSS: raw(p.offlineCss),
    OFFLINE_PANEL: p.app.panel,
    PWA_SCRIPT: p.app.script,
    TITLE: html`${tt('homeDocTitle', { series: p.config.series })}`,
    HEAD_META: headMeta({
      series: p.config.series,
      title: p.config.series,
      description: lang === 'ja' ? p.config.seriesSub : T.homeDesc,
      url,
      image: `${p.base}assets/hero.jpg`,
      icon: favicon(p.brand.color.ink, p.brand.color.accent),
      lang,
      alternates: p.langs.map((l) => ({ lang: l, url: `${p.base}${LANG_INFO[l].path}` })),
    }),
    // 書体の読み込み（scripts/site_theme.ts が作る。URL の & はそのまま）
    FONT_LINK: raw(fontLink(p.brand, lang)),
    THEME_CSS: styleText(themeCss(p.brand, lang)),
    SERIES: html`${p.config.series}`,
    FIRST_COURSE: html`${courses[0] ? `${courses[0].id}/` : `${root}${all[0]!.id}/`}`,
    HERO_FILE: html`${p.hero.file}`,
    HERO_CODE: joinHtml(
      p.hero.lines.map((l) => highlightTs(l, p.brand.syntax)),
      '\n',
    ),
    HERO_IMAGE: html`${root}assets/hero.jpg`,
    COURSES: joinHtml(cards, '\n'),
    OTHER_COURSES: otherSection,
    THEMES: joinHtml(
      p.themes.map((t) => themeCard(p, t, root)),
      '\n',
    ),
    REPO: html`${p.config.repoUrl}`,
    CREDITS: html`${tt('homeCredits', { voices: p.credits.join(T.creditsSep) })}`,
  };
  return fillTemplate(p.home, { marks, text: textOf(T) }, 'site/home.html');
};
