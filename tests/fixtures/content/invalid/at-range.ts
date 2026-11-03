// at（何番目の台詞の頭で出すか）が、台詞の範囲の外・整数でない。範囲の外の at は黙って丸められ、意図した台詞で出ない
import { course, lecture, say, W, type Expected } from './_base';

export const COURSE = course([
  lecture([
    {
      kind: 'goals',
      heading: 'ゴール',
      items: [
        { text: 'ひとつ目', at: 0 },
        { text: 'ふたつ目', at: 3 },
        { text: 'みっつ目', at: 1.5 },
      ],
      lines: say('一つ目です。', '二つ目です。'),
    },
    { kind: 'big', heading: '大事なこと', text: '台本が正本', textAt: -1, lines: say('台本が正本です。') },
  ]),
]);

export const EXPECTED: Expected[] = [
  ['error', 'at', `${W} 場面 1 goals.items[1].at`],
  ['error', 'at', `${W} 場面 1 goals.items[2].at`],
  ['error', 'at', `${W} 場面 2 big.textAt`],
];
