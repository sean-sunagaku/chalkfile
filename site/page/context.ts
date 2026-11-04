// 講座のページの画面の部品が共有するもの（データ・文字・学習の記録・動画・今のレクチャー）。作るのは site/course-page.ts
import type { CourseText, CourseTextBase } from '../i18n';
import type { texts } from '../lib/text';
import type { CourseData, LectureData } from './data';
import type { CourseStore, Learning } from './storage';

export type Page = {
  data: CourseData;
  lectures: LectureData[];
  /** 決まった文字（このページの言語。site/i18n の courseText） */
  T: CourseText;
  /** 決まった文字の {name} に値を入れる（tt）・数で形の変わる文字を選ぶ（tn）。差し込みの名前は型で確かめる（site/lib/text.ts の texts） */
  tt: ReturnType<typeof texts<CourseTextBase>>['tt'];
  tn: ReturnType<typeof texts<CourseTextBase>>['tn'];
  /** 学習の記録（画面が書き換え、store で保存する） */
  learning: Learning;
  store: CourseStore;
  video: HTMLVideoElement;
  /** 今のレクチャー（lectures の番号） */
  current: number;
};

/** 今のレクチャー。course-page の load が範囲を確かめた添字だけを設定する */
export const lectureOf = (page: Page): LectureData => page.lectures[page.current]!;
