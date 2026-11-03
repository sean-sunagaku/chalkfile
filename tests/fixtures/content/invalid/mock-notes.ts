// 画面の図: 注の block が部品の範囲の外（注が黙って出ない）・同じ画面の中で注の番号が重なる。右と左で番号が 1 から始まるのは正しい
import { course, lecture, say, W, type Expected } from './_base';

export const COURSE = course([
  lecture([
    {
      kind: 'screens',
      heading: '改善前と改善後',
      left: {
        label: '改善前',
        tone: 'coral',
        blocks: [
          { type: 'title', text: '申し込み', weak: true },
          { type: 'button', text: '送信', variant: 'primary', weak: true },
        ],
        notes: [
          { n: 1, text: '題が薄い', block: 0, at: 1 },
          { n: 1, text: 'ボタンが薄い', block: 1, at: 1 },
          { n: 2, text: '何が起きるか分からない', block: 2, at: 1 },
        ],
        at: 0,
      },
      right: {
        label: '改善後',
        tone: 'mint',
        blocks: [{ type: 'title', text: '申し込み' }],
        notes: [{ n: 1, text: '題がはっきり', block: 0, at: 1 }],
        at: 1,
      },
      lines: say('改善前です。', '改善後です。'),
    },
  ]),
]);

export const EXPECTED: Expected[] = [
  ['error', 'mock-notes', `${W} 場面 1 screens.left.notes[1].n`],
  ['error', 'mock-notes', `${W} 場面 1 screens.left.notes[2].block`],
];
