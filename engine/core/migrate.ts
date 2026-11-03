// 台本の形の版（Course の schemaVersion）と、古い形で書いた講座を今の形に直す決まり。
// 台本の形（engine/core/schema.ts の Course とその中身）を、前に書いた台本が読めなくなる形に変えるときは、COURSE_SCHEMA_VERSION を上げ、
// 1 つ前の版から直す関数を MIGRATIONS に足す（変えるときの手順と、凍結しているものは docs/adr/2026-11-03-frozen-contracts.md）。
// 直すのは講座の登録（engine/core/course-module.ts の defineCourseModule）で、台本のファイルは書き換えない。
// 今の版の講座は、同じオブジェクトをそのまま返す（写さない。読み込みの前と後で同じもの）
import type { AuthoredCourse } from './schema';

/** 今の台本の形の版。台本に schemaVersion を書かなければ 1 */
export const COURSE_SCHEMA_VERSION = 1;

/** 版 n の講座を、版 n + 1 の形に直す関数（キーは n）。版 1 より前の形は無いので、今は空 */
const MIGRATIONS: Readonly<Record<number, (course: AuthoredCourse) => AuthoredCourse>> = {};

/** 講座を書いた形の版（書いていなければ 1） */
export const schemaVersionOf = (course: { schemaVersion?: unknown }): unknown => course.schemaVersion ?? 1;

/** このエンジンが読める版か（1 から今の版までの整数） */
export const isKnownSchemaVersion = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= COURSE_SCHEMA_VERSION;

/**
 * 古い形の講座を、今の形に直す。今の版なら、同じ講座をそのまま返す。
 * 読めない版（今より新しい・整数でない）は直さずに返し、台本の検証（validateCourse）が、その講座の誤りにする（ほかの講座は読める）
 */
export const migrateCourse = (course: AuthoredCourse): AuthoredCourse => {
  const from = schemaVersionOf(course);
  if (!isKnownSchemaVersion(from)) return course;
  let out = course;
  for (let v = from; v < COURSE_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step)
      throw new Error(
        `台本の形を版 ${v} から ${v + 1} に直す関数が無い（engine/core/migrate.ts の MIGRATIONS に足す）`,
      );
    out = { ...step(out), schemaVersion: v + 1 };
  }
  return out;
};
