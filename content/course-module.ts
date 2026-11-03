// 講座 1 つ分の登録（講座と、言語ごとの訳）。各講座のフォルダの index.ts が export default し、content/courses.ts に 1 行で並べる
import type { CourseL10n, TranslatedLang } from './i18n';
import type { Course } from './types';

/** 講座と、言語ごとの訳（content/<講座>/<言語>/course.ts の CourseL10n。訳の無い講座は書かない） */
export type CourseModule = { course: Course; translations?: Partial<Record<TranslatedLang, CourseL10n>> };

/** 講座のフォルダの index.ts で使う（型を確かめるだけで、中身はそのまま返す） */
export const defineCourseModule = (m: CourseModule): CourseModule => m;
