// 中身が空: 台詞が無い場面・空の台詞・項目の無い一覧・場面の無い動画（画面に何も出ないか、声を作れない）
import { course, lecture, W, type Expected } from './_base';

export const COURSE = course([
  lecture([
    { kind: 'goals', heading: 'ゴール', items: [], lines: [] },
    { kind: 'sequence', heading: '順番', actors: [], steps: [], lines: [{ t: '登場人物です。' }] },
    { kind: 'table', heading: '表', columns: [], rows: [], lines: [{ t: '表です。' }] },
    { kind: 'big', heading: '大事なこと', text: ' ', lines: [{ t: '' }] },
  ]),
  lecture([], { id: 'X02', no: 2, title: '二本目' }),
]);

export const EXPECTED: Expected[] = [
  ['error', 'empty', `${W} 場面 1 goals.items`],
  ['error', 'lines', `${W} 場面 1 lines`],
  ['error', 'empty', `${W} 場面 2 sequence.actors`],
  ['error', 'empty', `${W} 場面 2 sequence.steps`],
  ['error', 'empty', `${W} 場面 3 table.columns`],
  ['error', 'empty', `${W} 場面 3 table.rows`],
  ['error', 'empty', `${W} 場面 4 big.text`],
  ['error', 'lines', `${W} 場面 4 lines[0].t`],
  ['error', 'scenes', 'invalid-sample/X02 scenes'],
];
