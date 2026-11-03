// states・sequence・timeline・concepts の参照の行き先が無い（矢印が画面の外に出る・focus が何も光らせない）
import { course, lecture, say, W, type Expected } from './_base';

export const COURSE = course([
  lecture([
    {
      kind: 'states',
      heading: '状態',
      nodes: [
        { key: 'start', code: 'はじめ', ja: '作る前', x: 500, y: 600, tone: 'slate', at: 0 },
        { key: 'active', code: 'active', ja: '使える', x: 1200, y: 600, tone: 'mint', at: 1 },
      ],
      edges: [{ from: 'activ', to: 'start', label: '戻る', at: 1 }],
      focus: [{ keys: ['canceled'], at: 1 }],
      lines: say('はじめです。', '使えます。'),
    },
    {
      kind: 'sequence',
      heading: '順番',
      actors: [
        { key: 'user', label: '利用者', tone: 'pink', icon: 'user' },
        { key: 'app', label: 'アプリ', tone: 'violet', icon: 'server' },
      ],
      steps: [{ from: 'user', to: 'server', label: '押す', at: 1 }],
      lines: say('二人です。', '押します。'),
    },
    {
      kind: 'timeline',
      heading: '時系列',
      items: [
        { key: 's1', title: '書く', sub: '1 日目', at: 0, tone: 'cyan' },
        { key: 's2', title: '作る', sub: '2 日目', at: 1, tone: 'mint' },
      ],
      focus: [
        { key: null, at: 0 },
        { key: 's3', at: 1 },
      ],
      lines: say('書きます。', '作ります。'),
    },
    {
      kind: 'concepts',
      heading: '言葉',
      cards: [
        { key: 'a', en: 'Scene', ja: '場面', desc: '画面の 1 まとまり', tone: 'violet', icon: 'layout', at: 0 },
        { key: 'b', en: 'Line', ja: '台詞', desc: '声と字幕の 1 文', tone: 'pink', icon: 'message', at: 1 },
      ],
      focus: [{ key: 'c', at: 1 }],
      lines: say('場面です。', '台詞です。'),
    },
  ]),
]);

export const EXPECTED: Expected[] = [
  ['error', 'ref', `${W} 場面 1 states.edges[0].from`],
  ['error', 'ref', `${W} 場面 1 states.focus[0].keys[0]`],
  ['error', 'ref', `${W} 場面 2 sequence.steps[0].to`],
  ['error', 'ref', `${W} 場面 3 timeline.focus[1].key`],
  ['error', 'ref', `${W} 場面 4 concepts.focus[0].key`],
];
