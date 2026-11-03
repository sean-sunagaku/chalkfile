// flow の矢印の行き先がノードに無い（描くと TypeError で止まる）・focus の key が無い・ノードの key が重なっている
import { course, lecture, say, W, type Expected } from './_base';

export const COURSE = course([
  lecture([
    {
      kind: 'flow',
      heading: '流れ',
      nodes: [
        { key: 'a', label: '台本', x: 420, y: 520, tone: 'cyan', at: 0 },
        { key: 'b', label: '声', x: 960, y: 520, tone: 'amber', at: 1 },
        { key: 'b', label: '動画', x: 1500, y: 520, tone: 'mint', at: 1 },
      ],
      edges: [
        { from: 'a', to: 'b', at: 1 },
        { from: 'b', to: 'c', at: 1 },
      ],
      focus: [{ keys: ['a', 'z'], at: 1 }],
      lines: say('台本です。', '声と動画です。'),
    },
  ]),
]);

export const EXPECTED: Expected[] = [
  ['error', 'key', `${W} 場面 1 flow.nodes[2].key`],
  ['error', 'ref', `${W} 場面 1 flow.edges[1].to`],
  ['error', 'ref', `${W} 場面 1 flow.focus[0].keys[1]`],
];
