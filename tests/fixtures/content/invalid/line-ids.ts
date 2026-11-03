// 台詞の id と部品の id: at に書いた id が場面の台詞に無い・台詞の id が重なる・空の id・注の blockId が画面の部品に無い・
// block と blockId が違う部品を指す・注に部品が無い・部品の id が重なる。読み込み（content/lines.ts）で番号に直せない id は文字のまま残り、検証が誤りにする
import { resolveCourse } from '../../../../content/lines';
import type { AuthoredLecture } from '../../../../content/types';
import { course, W, type Expected } from './_base';

const authored: AuthoredLecture = {
  id: 'X01',
  no: 1,
  section: { no: 1, title: 'はじめに' },
  title: '検証の見本',
  summary: '誤った台本の見本',
  docs: [],
  quiz: [],
  takeaways: [],
  scenes: [
    {
      kind: 'goals',
      heading: 'ゴール',
      items: [
        { text: 'ひとつ目', at: 'one' },
        { text: 'ふたつ目', at: 'two' },
      ],
      lines: [
        { id: 'one', t: '一つ目です。' },
        { id: '', t: '二つ目です。' },
        { id: 'one', t: '三つ目です。' },
      ],
    },
    { kind: 'big', heading: '大事なこと', text: '台本が正本', textAt: 'main', lines: [{ t: '台本が正本です。' }] },
    {
      kind: 'screens',
      heading: '改善前',
      left: {
        label: '改善前',
        tone: 'coral',
        at: 0,
        blocks: [
          { id: 'title', type: 'title', text: '申し込み' },
          { id: 'title', type: 'text', text: '説明' },
          { id: 'send', type: 'button', text: '送信', variant: 'primary' },
        ],
        notes: [
          { n: 1, text: '無い部品', blockId: 'missing', at: 0 },
          { n: 2, text: '食い違う', block: 0, blockId: 'send', at: 0 },
          { n: 3, text: '部品が無い', at: 0 },
          { n: 4, text: '送信', blockId: 'send', at: 0 },
        ],
      },
      lines: [{ t: '改善前の画面です。' }],
    },
  ],
};

// 検証にかけるのは、読み込んだあと（at の id を番号に直したあと）の講座（content/index.ts と同じ）
export const COURSE = resolveCourse({ ...course([]), lectures: [authored] });

export const EXPECTED: Expected[] = [
  ['error', 'line-id', `${W} 場面 1 lines[1].id`],
  ['error', 'line-id', `${W} 場面 1 lines[2].id`],
  ['error', 'at', `${W} 場面 1 goals.items[1].at`],
  ['error', 'at', `${W} 場面 2 big.textAt`],
  ['error', 'mock-notes', `${W} 場面 3 screens.left.blocks[1].id`],
  ['error', 'mock-notes', `${W} 場面 3 screens.left.notes[0].blockId`],
  ['error', 'mock-notes', `${W} 場面 3 screens.left.notes[1].blockId`],
  ['error', 'mock-notes', `${W} 場面 3 screens.left.notes[2].block`],
];
