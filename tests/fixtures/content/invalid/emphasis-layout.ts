// 注意だけ（誤りは 0）: ** が閉じていない・強調にならない項目の **・焼き込み字幕が 3 行になる見込み・見出しが 1 行に入らない見込み・時系列の題の空白（と、その古い書き方）
import { course, lecture, say, W, type Expected } from './_base';

export const COURSE = course([
  lecture([
    { kind: 'big', heading: '大事なこと', text: '台本が **正本', lines: say('台本が正本です。') },
    {
      kind: 'points',
      heading: '見出しがとても長いので一行に入らずに画面の右の外まではみ出してしまう場面の見出し',
      items: [{ title: '**書く**', at: 0 }],
      lines: say('台本に場面を書いて、台詞の番号で要素を出し、声を作って時刻を決め、静止画で確かめてから書き出す、という順番で進めると、あとで直すときにも同じ手順で作り直せるので、迷わずに済みます。'),
    },
    {
      kind: 'timeline',
      heading: '時系列',
      items: [{ key: 's1', title: 'STEP 1　書く　台本', sub: '1 日目', at: 0, tone: 'cyan' }],
      lines: say('書きます。'),
    },
  ]),
]);

export const EXPECTED: Expected[] = [
  ['warning', 'emphasis', `${W} 場面 1 big.text`],
  ['warning', 'emphasis', `${W} 場面 2 points.items[0].title`],
  ['warning', 'caption-lines', `${W} 場面 2 lines[0].t`],
  ['warning', 'heading-width', `${W} 場面 2 heading`],
  ['warning', 'style', `${W} 場面 3 timeline.items[0].title`],
  ['warning', 'legacy', `${W} 場面 3 timeline.items[0].title`],
];
