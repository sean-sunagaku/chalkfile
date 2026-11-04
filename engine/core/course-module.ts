// 講座 1 つ分の登録（講座と、言語ごとの訳）。各講座のフォルダの index.ts が export default し、content/courses.ts に 1 行で並べる
import type { CourseL10n, TranslatedLang } from './i18n';
import { migrateCourse } from './migrate';
import type { Reading } from './reading';
import type { AuthoredCourse } from './schema';

/**
 * 講座サイトの一覧のページの最初の画面に出す、台本の抜き出し（「台本はこう書く」の見本）。file はリポジトリの直下からの場所、
 * lines は見せる行（file の行を写し、長い行は「, … },」で切る）。並び（order）で最初の講座のものを使う。
 * 写した行が file と合っているかは tests/unit/site-build.test.ts が見る
 */
export type HeroSnippet = { file: string; lines: readonly string[] };

/**
 * 講座と、言語ごとの訳（content/<講座>/<言語>/course.ts の CourseL10n。訳の無い講座は書かない）と、講座の読みの辞書
 * （content/<講座>/reading.ts。共通の辞書 engine/core/reading.ts より優先し、この講座の日本語の台詞にだけ効く。無い講座は書かない）。
 * course は台本に書いたままの講座（at に台詞の id を書いた動画があってよい。番号に直すのは content/index.ts）
 */
export type CourseModule = {
  course: AuthoredCourse;
  translations?: Partial<Record<TranslatedLang, CourseL10n>>;
  reading?: Reading;
  heroSnippet?: HeroSnippet;
};

/**
 * 講座のフォルダの index.ts で使う。型を確かめ、古い形（schemaVersion が古い）で書いた講座は今の形に直す（engine/core/migrate.ts）。
 * 今の形の講座は、中身をそのまま返す（同じオブジェクト）
 */
export const defineCourseModule = (m: CourseModule): CourseModule => {
  const course = migrateCourse(m.course);
  return course === m.course ? m : { ...m, course };
};
