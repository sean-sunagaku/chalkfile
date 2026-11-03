// 講座のページ（site/template.html）を描く（純粋）。版の印（scripts/site-version.ts）を入れたまま描き、CSP は呼ぶ側が付ける
import { LANG_INFO, type Lang } from '../../content/i18n';
import type { Course, Theme } from '../../content/types';
import { fill, type SiteText } from '../../site/i18n';
import { fontLink, themeCss } from '../site_theme';
import type { SiteConfig } from '../validate';
import { type LectureModel, plain } from './model';
import { type CoursesIn, esc, favicon, fillText, headMeta, langNav } from './parts';

export type CoursePageInput = {
  /** site/template.html の中身 */
  template: string;
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
  app: { head: string; panel: string; script: string };
  /** site/offline.css の中身 */
  offlineCss: string;
  /** ページの中の JSON（model.ts の courseJson） */
  json: string;
};

/** 講座のページの HTML（CSP の印 __CSP__ と版の印は残したまま） */
export const renderCoursePage = (p: CoursePageInput): string => {
  const info = LANG_INFO[p.lang];
  const T = p.T;
  const cid = `${info.path}${p.course.id}`;
  const url = `${p.base}${cid}/`;
  const firstPoster = `${url}media/${p.lectures[0].key}.jpg`;
  return fillText(p.template, T)
    .replace('__LANG__', () => info.html)
    .replace('__HOME__', () => '../')
    .replace('__LANG_NAV__', () =>
      langNav({
        langs: p.langs,
        coursesIn: p.coursesIn,
        lang: p.lang,
        root: p.root,
        label: T.langNav,
        courseId: p.course.id,
      }),
    )
    .replace('__EV_HINT_TAIL__', () => esc(T.evHintTail).replace('{id}', '<span class="mono">xx-01-s01</span>'))
    .replace('__NOTE_AT_ZERO__', () => esc(fill(T.noteAt, { t: '00:00' })))
    .replace('__PWA_HEAD__', () => p.app.head)
    .replace('__OFFLINE_CSS__', () => p.offlineCss)
    .replace('__OFFLINE_PANEL__', () => p.app.panel)
    .replace('__PWA_SCRIPT__', () => p.app.script)
    .replace('__TITLE__', () => esc(fill(T.pageTitle, { course: p.course.title, series: p.config.series })))
    .replace('__HEAD_META__', () =>
      headMeta({
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
    )
    .replace('__FONT_LINK__', () => fontLink(p.theme, p.lang))
    .replace('__THEME_CSS__', () => themeCss(p.theme, p.lang))
    .replace('__SERIES__', () => esc(p.config.series))
    .replace('__BRAND_SUB__', () => esc(p.course.title))
    .replace('__HEADLINE__', () => esc(plain(p.course.headline)))
    .replace('__DOCS_NOTE__', () => esc(p.course.docsNote))
    .replace('__COURSE_JSON__', () => p.json);
};
