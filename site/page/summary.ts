// 講座の本数と長さの文字（見出しの下・カリキュラムの欄）と、レクチャーの見出しの上の札。画面（site/page/curriculum.ts・
// site/course-page.ts）と、JS が無くても読めるように最初のレクチャーとカリキュラムを HTML に書く組み立て（scripts/site/render-course.ts）が
// 同じものを使う（DOM を使わない）
import type { CourseTextBase } from '../i18n';
import type { texts } from '../lib/text';
import type { CourseData, LectureData } from './data';
import { pad2 } from './format';

/** 講座のページの文字を引く関数（site/lib/text.ts の texts<CourseTextBase>） */
export type CourseTexts = ReturnType<typeof texts<CourseTextBase>>;

/** 見出しの下（courseMeta）とカリキュラムの欄（curSum）の、本数と長さ。durations はレクチャーの長さ（秒） */
export const courseCounts = (
  { tt, tn }: CourseTexts,
  course: Pick<CourseData['course'], 'unitLabel' | 'sections' | 'planned'>,
  durations: readonly number[],
) => {
  /** 本数（講座の呼び名が CHAPTER なら章の数。数で形の変わる言語は tn が選ぶ） */
  const count = (n: number) => tn(course.unitLabel === 'CHAPTER' ? 'chapterCount' : 'lectureCount', n);
  const all = durations.length + course.planned.length;
  const plan = course.planned.length ? tt('planned', { count: count(all) }) : '';
  const min = Math.round(durations.reduce((a, d) => a + d, 0) / 60);
  return {
    curSum: tt('curSum', { count: count(durations.length), min, plan }),
    courseMeta: tt('courseMeta', {
      sections: tn('sectionCount', course.sections.length),
      count: count(durations.length),
      min,
      plan,
    }),
  };
};

/** レクチャーの見出しの上の札（LECTURE 01・SECTION 1 はじめに） */
export const eyebrowOf = (sep: string, unit: string, lec: Pick<LectureData, 'no' | 'section'>) =>
  `${unit} ${pad2(lec.no)}${sep}SECTION ${lec.section.no} ${lec.section.title}`;
