// 一覧のページ（site/home.html）を描く（純粋）。講座のカード・まだ訳していない講座・テーマの一覧・最初の画面の台本の抜き出し。CSP は呼ぶ側が付ける
import type { HeroSnippet } from '../../content/course-module';
import { LANG_INFO, type Lang, videoKey } from '../../content/i18n';
import type { Course, Theme } from '../../content/types';
import { fill, type SiteText } from '../../site/i18n';
import { fontLink, themeCss } from '../site_theme';
import type { SiteConfig } from '../validate';
import { plain } from './model';
import { type CoursesIn, esc, favicon, fillText, headMeta, langNav } from './parts';

/** 一覧ページから見た、講座の最初の動画のポスター（root はその一覧ページから見たサイトの最上位） */
export const homePosterOf = (c: Course, root: string) => {
  const l = (c.lang ?? 'ja') as Lang;
  const key = videoKey(c.lectures[0].id, l);
  return `${root}${LANG_INFO[l].path}${c.id}/media/${key}.jpg`;
};

/** 文字列・キー・数・省略記号を 1 回の走査で塗る（塗った span の中をもう一度塗らない） */
const highlightTs = (line: string, S: Theme['syntax']) =>
  esc(line).replace(
    /('[^']*')|\b([a-z][A-Za-z]*)(?=:)|\b(\d+)\b|(…)/g,
    (m, str, key, num) => `<span style="color:${str ? S.string : key ? S.fn : num ? S.number : S.comment}">${m}</span>`,
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
  T: SiteText;
  /** 一覧のページのテーマ（既定のテーマ） */
  brand: Theme;
  /** 並べるテーマ（content/themes.ts の THEMES） */
  themes: readonly Theme[];
  /** 講座のテーマ（content/themes.ts の themeOf） */
  themeOf: (id?: Course['theme']) => Theme;
  /** テーマの見本の画像（site/assets/themes/<id>.jpg）があるか */
  hasThemeImage: (id: string) => boolean;
  /** テーマの紹介文（訳の言語。無ければ日本語の summary） */
  themeSummary: (theme: Theme) => string;
  /** 講座の動画の合計の長さ（分） */
  minutesOf: (course: Course) => number;
  /** 一覧のページのクレジット（model.ts の homeCredits） */
  credits: readonly string[];
  hero: HeroSnippet;
  /** 保存機能の部品（parts.ts の appParts） */
  app: { head: string; panel: string; script: string };
  /** site/offline.css の中身 */
  offlineCss: string;
};

/** 講座のカード。href・画像はその一覧ページからの場所。tags は事実の札に足すもの（言語など） */
const courseCard = (p: HomePageInput, c: Course, theme: Theme, o: { href: string; poster: string; tags: string[] }) => {
  const T = p.T;
  const t = theme;
  const minutes = p.minutesOf(c);
  const style = `--card-grad: linear-gradient(100deg, ${t.gradient.join(', ')}); --card-soft: ${t.color.surface2}; --card-ink: ${t.tones.violet}`;
  const count =
    c.unitLabel === 'CHAPTER'
      ? `${fill(T.cardChapters, { n: c.lectures.length })}${c.syllabus ? fill(T.cardPlanned, { n: c.syllabus.chapters.length }) : ''}`
      : fill(T.cardLectures, { n: c.lectures.length });
  const lang = p.lang;
  return [
    `<a class="course" href="${esc(o.href)}" style="${esc(style)}"${c.lang && c.lang !== lang ? ` lang="${LANG_INFO[c.lang].html}"` : !c.lang && lang !== 'ja' ? ' lang="ja"' : ''}>`,
    `  <div class="poster"><img src="${esc(o.poster)}" alt="" width="1280" height="720" loading="lazy"></div>`,
    '  <div class="body">',
    `    <h3>${esc(c.title)}</h3>`,
    `    <p>${esc(plain(c.headline))}</p>`,
    `    <ul class="facts"><li>${esc(count)}</li><li>${esc(fill(T.cardMinutes, { min: Math.round(minutes) }))}</li><li class="is-theme">${esc(fill(T.cardTheme, { theme: t.label }))}</li>${o.tags.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>`,
    `    <span class="go">${esc(T.cardOpen)}</span>`,
    '  </div>',
    '</a>',
  ].join('\n');
};

/** 一覧のページの HTML（CSP の印 __CSP__ は残したまま） */
export const renderHomePage = (p: HomePageInput): string => {
  const T = p.T;
  const lang = p.lang;
  const info = LANG_INFO[lang];
  // 一覧ページから見たサイトの最上位（日本語は ./、訳は ../）
  const root = lang === 'ja' ? './' : '../';
  const courses = p.coursesIn(lang);
  const all = p.coursesIn('ja');
  const cards = courses
    .map((c) => {
      // 日本語の一覧では、訳のある講座に言語の札を付ける
      const tags =
        lang === 'ja'
          ? p.langs
              .filter((l) => l !== 'ja' && p.coursesIn(l).some((x) => x.id === c.id))
              .map((l) => LANG_INFO[l].label)
          : [];
      return courseCard(p, c, p.themeOf(c.theme), {
        href: `${c.id}/`,
        poster: homePosterOf(c, root),
        tags: tags.length ? [tags.join('・')] : [],
      });
    })
    .join('\n');
  // 訳の一覧では、まだ訳していない講座を「日本語だけ」として並べる
  const others = lang === 'ja' ? [] : all.filter((c) => !courses.some((x) => x.id === c.id));
  const otherSection = others.length
    ? [
        '    <section id="more-courses" aria-labelledby="more-title">',
        `      <h2 id="more-title">${esc(T.homeOtherTitle)}</h2>`,
        `      <p class="lede">${esc(T.homeOtherLede)}</p>`,
        '      <div class="courses">',
        others
          .map((c) =>
            courseCard(p, c, p.themeOf(c.theme), {
              href: `${root}${c.id}/`,
              poster: homePosterOf(c, root),
              tags: [T.cardLang],
            }),
          )
          .join('\n'),
        '      </div>',
        '    </section>',
      ].join('\n')
    : '';
  const themeCards = p.themes
    .map((t) => {
      const img = `assets/themes/${t.id}.jpg`;
      const sw = [t.color.bg, t.color.ink, t.color.accent, t.tones.pink, t.tones.cyan, t.tones.mint];
      return [
        '<article class="theme">',
        p.hasThemeImage(t.id)
          ? `  <img src="${root}${img}" alt="${esc(fill(T.themeAlt, { theme: t.label }))}" width="960" height="540" loading="lazy">`
          : '',
        '  <div class="body">',
        `    <h3>${esc(t.label)} <code>theme: '${esc(t.id)}'</code></h3>`,
        `    <div class="swatches" aria-hidden="true">${sw.map((c) => `<span style="background:${c}"></span>`).join('')}</div>`,
        `    <p>${esc(p.themeSummary(t))}</p>`,
        '  </div>',
        '</article>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');
  const url = `${p.base}${info.path}`;
  return fillText(p.home, T)
    .replace('__LANG__', () => info.html)
    .replace('__LANG_NAV__', () => langNav({ langs: p.langs, coursesIn: p.coursesIn, lang, root, label: T.langNav }))
    .replace('__PWA_HEAD__', () => p.app.head)
    .replace('__OFFLINE_CSS__', () => p.offlineCss)
    .replace('__OFFLINE_PANEL__', () => p.app.panel)
    .replace('__PWA_SCRIPT__', () => p.app.script)
    .replace('__TITLE__', () => esc(fill(T.homeDocTitle, { series: p.config.series })))
    .replace('__HEAD_META__', () =>
      headMeta({
        series: p.config.series,
        title: p.config.series,
        description: lang === 'ja' ? p.config.seriesSub : T.homeDesc,
        url,
        image: `${p.base}assets/hero.jpg`,
        icon: favicon(p.brand.color.ink, p.brand.color.accent),
        lang,
        alternates: p.langs.map((l) => ({ lang: l, url: `${p.base}${LANG_INFO[l].path}` })),
      }),
    )
    .replace('__FONT_LINK__', () => fontLink(p.brand, lang))
    .replace('__THEME_CSS__', () => themeCss(p.brand, lang))
    .replaceAll('__SERIES__', () => esc(p.config.series))
    .replace('__FIRST_COURSE__', () => (courses[0] ? `${courses[0].id}/` : `${root}${all[0].id}/`))
    .replace('__HERO_FILE__', () => esc(p.hero.file))
    .replace('__HERO_CODE__', () => p.hero.lines.map((l) => highlightTs(l, p.brand.syntax)).join('\n'))
    .replace('__HERO_IMAGE__', () => `${root}assets/hero.jpg`)
    .replace('__COURSES__', () => cards)
    .replace('__OTHER_COURSES__', () => otherSection)
    .replace('__THEMES__', () => themeCards)
    .replaceAll('__REPO__', () => esc(p.config.repoUrl))
    .replace('__CREDITS__', () => esc(fill(T.homeCredits, { voices: p.credits.join(T.creditsSep) })));
};
