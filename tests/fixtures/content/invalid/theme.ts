// 講座のテーマの id が content/themes.ts に無い（描くと止まる）・配役の色の名前が無い
import type { Tone } from '../../../../content/types';
import { course, lecture, say, type Expected } from './_base';

export const COURSE = course([lecture([{ kind: 'big', heading: '大事なこと', text: '台本が正本', lines: say('台本が正本です。') }])], {
  // @ts-expect-error 型を通さず届いた入力の、実行時の検証も確かめる
  theme: 'neon',
  cast: { narrator: { name: '先生', tone: 'gold' as unknown as Tone } },
});

export const EXPECTED: Expected[] = [
  ['error', 'theme', 'invalid-sample theme'],
  ['error', 'tone', 'invalid-sample cast.narrator.tone'],
];
