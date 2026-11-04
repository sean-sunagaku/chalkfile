// 掛け合いの声の別名と、共通の配役。声の実際の設定は chalkfile.config.ts。
import type { Course } from '../types';

export const Z = 'zundamon' as const;
export const ZC = 'zundamon-cry' as const;
export const T = 'tsukkomi' as const;
export const TEN = 'tennokoe' as const;

type Cast = NonNullable<Course['cast']>;
const DEFAULT_CAST: Cast = {
  zundamon: { name: 'ずんだもん', tone: 'mint' },
  'zundamon-cry': { name: 'ずんだもん', tone: 'mint' },
  narrator: { name: '先生', tone: 'coral' },
  tsukkomi: { name: '先生', tone: 'coral' },
  tennokoe: { name: '天の声', tone: 'violet' },
};

/** 講座ごとに新しい配役を作る。名前や色を変える役だけ上書きできる。 */
export const comedyCast = (overrides: Cast = {}): Cast => Object.fromEntries(
  Object.entries({ ...DEFAULT_CAST, ...overrides }).flatMap(([voice, role]) => role ? [[voice, { ...role }]] : []),
);
