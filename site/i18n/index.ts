// 講座サイトの決まった文字（言語ごとのファイル site/i18n/<言語>.ts）を集め、置き場所ごとの表にする。
// 言語を足すときは、言語の一覧（content/langs.ts）に 1 つ足し、site/i18n/<言語>.ts を作って LOCALES に並べる（型のエラーに従う。
// 手順は .claude/skills/study-video-course/references/i18n.md の「言語を足す」）。
//
//   表           読むところ                                                  ページに入るか
//   common        講座のページと一覧のページ                                  講座のページの JSON（course と一緒に）
//   course        site/template.html の {{key}}・画面 site/course-page.ts と site/page/   講座のページの JSON の text
//   home          site/home.html の {{key}}・scripts/site/render-home.ts      入らない（組み立てで HTML にする）
//   panel         site/offline-panel.html の {{key}}（client の文字も使える）  入らない
//   client        保存の画面 site/offline-client.ts                           ページの pwa-data の text
//   offlinePage   未保存のページ site/offline.html の {{<言語>.key}}           入らない
//   notFound      無いページ（404.html）                                        入らない
//   app           manifest.webmanifest の説明                                 入らない
//   sw            Service Worker の文字（scripts/pwa.ts が sw.js の設定に入れる） sw.js
//   themes        一覧のページのテーマの紹介文                                入らない
import type { Lang } from '../../content/langs';
import type { LocaleOf } from './define';
import { en } from './en';
import { ja } from './ja';
import { zh } from './zh';

/** 日本語の表の型（文字の型に差し込みの名前がある。site/lib/text.ts の texts に渡して、差し込みの名前を確かめる） */
export type JaLocale = typeof ja;
/** どの言語にも使える表の型 */
export type Locale = LocaleOf<JaLocale>;

/** 言語ごとの決まった文字 */
export const LOCALES: Record<Lang, Locale> = { ja, en, zh };

/** 講座のページの文字（common と course。texts の B） */
export type CourseTextBase = JaLocale['common'] & JaLocale['course'];
export type CourseText = LocaleOf<CourseTextBase>;
export const courseText = (lang: Lang): CourseText => ({ ...LOCALES[lang].common, ...LOCALES[lang].course });

/** 一覧のページの文字（common と home。texts の B） */
export type HomeTextBase = JaLocale['common'] & JaLocale['home'];
export type HomeText = LocaleOf<HomeTextBase>;
export const homeText = (lang: Lang): HomeText => ({ ...LOCALES[lang].common, ...LOCALES[lang].home });

/** 保存の画面の文字（texts の B） */
export type ClientTextBase = JaLocale['client'];
export type ClientText = LocaleOf<ClientTextBase>;

/** Service Worker が返す文字（sw.js の設定の messages） */
export type SwText = Locale['sw'];
