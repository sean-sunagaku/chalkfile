// コード: 光らせる行がコードの行の外・始まりが終わりより後・行が多すぎる（注意。style.md の目安は 18 行）
import { course, lecture, say, W, type Expected } from './_base';

const code = Array.from({ length: 19 }, (_, i) => `line_${i + 1} = ${i + 1}`).join('\n');

export const COURSE = course([
  lecture([
    {
      kind: 'code',
      heading: 'コード',
      lang: 'python',
      file: 'sample.py',
      code,
      marks: [
        { from: 2, to: 25, at: 1 },
        { from: 5, to: 3, at: 1 },
        { from: 0, to: 1, at: 2 },
      ],
      lines: say('コードです。', '光らせます。', 'もう一つです。'),
    },
  ]),
]);

export const EXPECTED: Expected[] = [
  ['error', 'code-marks', `${W} 場面 1 code.marks[0]`],
  ['error', 'code-marks', `${W} 場面 1 code.marks[1]`],
  ['error', 'code-marks', `${W} 場面 1 code.marks[2]`],
  ['warning', 'style', `${W} 場面 1 code.code`],
];
