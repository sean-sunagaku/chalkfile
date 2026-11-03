// 講座のページの画面の部品が共有するもの（データ・文字・学習の記録・動画・今のレクチャー）。作るのは site/course-page.ts
import type { SiteKey, SiteText } from '../i18n';
import type { CourseData, LectureData } from './data';
import type { CourseStore, Learning } from './storage';

export type Page = {
  data: CourseData;
  lectures: LectureData[];
  /** 決まった文字（このページの言語） */
  T: SiteText;
  /** 決まった文字の {name} に値を入れる */
  tt: (key: SiteKey, vars?: Record<string, string | number>) => string;
  /** 学習の記録（画面が書き換え、store で保存する） */
  learning: Learning;
  store: CourseStore;
  video: HTMLVideoElement;
  /** 今のレクチャー（lectures の番号） */
  current: number;
};

/** 今のレクチャー */
export const lectureOf = (page: Page): LectureData => page.lectures[page.current];
