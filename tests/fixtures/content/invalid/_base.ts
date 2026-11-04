// 誤った台本の見本の土台。正しい講座（1 講座・動画 1 本）を作る道具で、各ファイルはここから 1 か所ずつ壊す。
// 各ファイルは COURSE（検証する講座）と EXPECTED（見つかるべき誤りと注意の全部）を export する。tests/unit/validate.test.ts が、過不足なく見つかるかを確かめる
import type { Course, Lecture, Line, Scene } from '../../../../content/types';
import type { Level, Rule } from '../../../../engine/core/validate';

/** 見本の動画の場所（講座/動画） */
export const W = 'invalid-sample/X01';

/** 短い台詞を並べる */
export const say = (...ts: string[]): Line[] => ts.map((t) => ({ t }));

/** 正しい動画 1 本。scenes と、変えたい項目だけを渡す */
export const lecture = (scenes: Scene[], patch: Partial<Lecture> = {}): Lecture => ({
  id: 'X01',
  no: 1,
  section: { no: 1, title: 'はじめに' },
  title: '検証の見本',
  summary: '誤った台本の見本',
  docs: [],
  quiz: [],
  takeaways: [],
  scenes,
  ...patch,
});

/** 正しい講座 1 つ */
export const course = (lectures: Lecture[], patch: Partial<Course> = {}): Course => ({
  id: 'invalid-sample',
  prefix: 'X',
  order: 1,
  title: '検証の見本',
  subtitle: '誤った台本の見本',
  headline: '誤った台本の見本',
  sections: [{ no: 1, title: 'はじめに' }],
  lectures,
  docsNote: '見本です。',
  sourceNote: '見本です。',
  ...patch,
});

/** 見つかるべきもの（where は全部を書く） */
export type Expected = [level: Level, rule: Rule, where: string];
