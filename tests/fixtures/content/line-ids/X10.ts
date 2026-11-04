import type { AuthoredLecture } from '../../../../content/types';

const Z = 'zundamon' as const; // ボケ: ずんだもん（配役は course.ts の cast）

/**
 * at を台詞の id で書いた見本（番号で数えない書き方）。台詞に id を付け、画面の要素の at にその id を書く。
 * 画面の図の注は、部品の id（blockId）で指す。読み込むとき（content/lines.ts）に番号に直る。
 * 台詞を足しても並べ替えても、要素は同じ台詞に付いたまま動く（tests/unit/lines.test.ts）
 */
export const X10: AuthoredLecture = {
  id: 'X10',
  no: 1,
  section: { no: 1, title: 'はじめに' },
  title: 'id で書く見本',
  summary: 'at を台詞の id で書いた見本。',
  docs: [{ title: 'サンプルアプリの説明', url: 'https://example.com/docs' }],
  quiz: [{ q: 'at に書けるものは？', choices: ['台詞の番号だけ', '台詞の番号か id'], answer: 1, explain: 'id で書くと、台詞を足しても数え直さなくてよい。' }],
  takeaways: ['at は台詞の id でも書ける'],
  scenes: [
    {
      kind: 'goals',
      heading: 'この見本のゴール',
      items: [
        { text: 'id の付け方を知る', at: 'first' },
        { text: 'at に id を書く', at: 'second' },
      ],
      lines: [
        { t: 'ゴールは二つです。' },
        { id: 'first', t: '台詞に id を付けること。', sfx: 'pop' },
        { id: 'second', t: 'at に、その id を書くこと。', sfx: 'pop' },
      ],
    },
    {
      kind: 'compare',
      heading: '番号と id',
      left: { title: '番号', tone: 'coral', at: 'left', items: [{ text: '数え直す', at: 'left-item' }] },
      right: { title: 'id', tone: 'mint', at: 'right', items: [{ text: '数え直さない', at: 'right-item' }] },
      verdict: { text: 'id なら台詞を足しても動かない', at: 'verdict' },
      lines: [
        { id: 'left', t: '左は、番号で書いたときです。' },
        { id: 'left-item', t: '台詞を足すと、後ろの番号を全部数え直します。', sfx: 'pop' },
        { t: 'それは大変なのだ！', v: Z },
        { id: 'right', t: '右は、id で書いたときです。' },
        { id: 'right-item', t: '台詞を足しても、数え直しません。', sfx: 'pop' },
        { id: 'verdict', t: 'id なら、要素は同じ台詞に付いたまま動きます。', sfx: 'chime' },
      ],
    },
    {
      kind: 'screens',
      heading: '注は部品の id で指す',
      left: {
        label: '改善前',
        tone: 'coral',
        at: 'before',
        blocks: [
          { id: 'title', type: 'title', text: '申し込み', weak: true },
          { type: 'divider' },
          { id: 'send', type: 'button', text: '送信', variant: 'primary', weak: true },
        ],
        notes: [
          { n: 1, text: '題が薄い', blockId: 'title', at: 'weak' },
          { n: 2, text: 'ボタンが薄い', blockId: 'send', at: 'weak' },
        ],
      },
      lines: [
        { id: 'before', t: '改善前の画面です。' },
        { id: 'weak', t: '題もボタンも、薄くて読みにくいです。', sfx: 'pop' },
      ],
    },
    {
      kind: 'quiz',
      no: 1,
      question: 'at は台詞の id でも書ける',
      answer: true,
      explain: '台詞に id を付ければ、その台詞の頭で出せる。',
      revealAt: 'reveal',
      hold: 1,
      lines: [
        { t: '問題です。at は台詞の id でも書ける。マルかバツか。' },
        { id: 'reveal', t: '答えはマルです。', sfx: 'correct' },
      ],
    },
  ],
};
