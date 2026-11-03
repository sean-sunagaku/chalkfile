// 手で書いた派生データの食い違い: セクションの題・オープニングの札・エンディングの次の動画。
// 番号の違いは誤り、題の違いと、まだ無い動画への予告（W01 の next: { no: 2 } と同じ形）は注意
import { course, lecture, say, type Expected } from './_base';

export const COURSE = course(
  [
    lecture(
      [
        { kind: 'opening', section: 'SECTION 2　はじめに', title: '一本目', lines: say('一本目です。') },
        { kind: 'ending', next: { no: 2, title: '二本目（長い題）' }, lines: say('次へ。') },
      ],
      { section: { no: 1, title: 'はじめ' } },
    ),
    lecture(
      [
        { kind: 'opening', section: 'SECTION 2　次の章', title: '二本目', lines: say('二本目です。') },
        { kind: 'ending', next: { no: 4, title: '三本目' }, lines: say('次へ。') },
      ],
      { id: 'X02', no: 2, title: '二本目', section: { no: 2, title: 'つぎ' } },
    ),
    lecture([{ kind: 'ending', next: { no: 4, title: '四本目' }, lines: say('次は四本目です。') }], { id: 'X03', no: 3, title: '三本目', section: { no: 2, title: 'つぎ' } }),
  ],
  {
    sections: [
      { no: 1, title: 'はじめに' },
      { no: 2, title: 'つぎ' },
    ],
  },
);

export const EXPECTED: Expected[] = [
  ['error', 'section', 'invalid-sample/X01 section.title'],
  ['error', 'section', 'invalid-sample/X01 場面 1 opening.section'],
  ['warning', 'ending-next', 'invalid-sample/X01 場面 2 ending.next.title'],
  ['warning', 'section', 'invalid-sample/X02 場面 1 opening.section'],
  ['error', 'ending-next', 'invalid-sample/X02 場面 2 ending.next.no'],
  ['warning', 'ending-next', 'invalid-sample/X03 場面 1 ending.next'],
];
