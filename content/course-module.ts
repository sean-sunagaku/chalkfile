// 講座 1 つ分の登録（講座と、言語ごとの訳）。各講座のフォルダの index.ts が export default し、content/courses.ts に 1 行で並べる
import type { CourseL10n, TranslatedLang } from './i18n';
import type { Course } from './types';

/**
 * 講座サイトの一覧のページの最初の画面に出す、台本の抜き出し（「台本はこう書く」の見本）。file はリポジトリの直下からの場所、
 * lines は見せる行（file の行を写し、長い行は「, … },」で切る）。並び（order）で最初の講座のものを使う。
 * 写した行が file と合っているかは tests/site-build.test.ts が見る
 */
export type HeroSnippet = { file: string; lines: readonly string[] };

/** 講座と、言語ごとの訳（content/<講座>/<言語>/course.ts の CourseL10n。訳の無い講座は書かない） */
export type CourseModule = {
  course: Course;
  translations?: Partial<Record<TranslatedLang, CourseL10n>>;
  heroSnippet?: HeroSnippet;
};

/** 講座のフォルダの index.ts で使う（型を確かめるだけで、中身はそのまま返す） */
export const defineCourseModule = (m: CourseModule): CourseModule => m;
