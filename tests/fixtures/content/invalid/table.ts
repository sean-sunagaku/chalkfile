// 表: widths の数が列と合わない（幅が NaN% になる）・セルの数が列と合わない・等幅の列の番号が範囲の外・行が多すぎる（注意）
import { course, lecture, say, W, type Expected } from './_base';

const row = (a: string, at: number) => ({ cells: [a, 'b', 'c'], at });

export const COURSE = course([
  lecture([
    {
      kind: 'table',
      heading: '表',
      columns: ['項目', '値', 'メモ'],
      widths: [0.5, 0.5],
      mono: [3],
      rows: [row('1', 0), { cells: ['2', 'b'], at: 1 }, row('3', 1), row('4', 2), row('5', 2), row('6', 2), row('7', 2)],
      lines: say('表です。', '二行目です。', '残りです。'),
    },
  ]),
]);

export const EXPECTED: Expected[] = [
  ['error', 'table', `${W} 場面 1 table.widths`],
  ['error', 'table', `${W} 場面 1 table.rows[1].cells`],
  ['error', 'table', `${W} 場面 1 table.mono[0]`],
  ['warning', 'style', `${W} 場面 1 table.rows`],
];
