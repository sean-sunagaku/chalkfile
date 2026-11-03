// 名前の打ち間違い: 効果音・声・BGM の指示・色の名前・根拠の種類・端末の出力の色（型を外して書いた台本や、型の外から来た値）
import type { Evidence, Line, SfxId, TerminalTone, Tone, VoiceId } from '../../../../content/types';
import { course, lecture, say, W, type Expected } from './_base';

const lines: Line[] = [
  { t: '一つ目です。', sfx: 'boing' as unknown as SfxId },
  { t: '二つ目です。', v: 'robot' as unknown as VoiceId, sfxAfter: 'zap' as unknown as SfxId },
  { t: '三つ目です。', bgm: 'stop' as unknown as 'cut' },
];

export const COURSE = course([
  lecture([
    {
      kind: 'points',
      heading: '点',
      evidence: 'rumor' as unknown as Evidence,
      items: [
        { title: '書く', at: 0, tone: 'gold' as unknown as Tone },
        { title: '確かめる', at: 1, tone: 'mint' },
      ],
      lines,
    },
    {
      kind: 'terminal',
      heading: '端末',
      title: 'Terminal',
      // 文字だけの行・ok の行は正しい。green は端末の出力の色に無い
      entries: [{ cmd: 'ls', out: ['plain', { text: '成功', tone: 'ok' }, { text: '緑', tone: 'green' as unknown as TerminalTone }], at: 1 }],
      lines: say('端末です。', '流します。'),
    },
  ]),
]);

export const EXPECTED: Expected[] = [
  ['error', 'sfx', `${W} 場面 1 lines[0].sfx`],
  ['error', 'voice', `${W} 場面 1 lines[1].v`],
  ['error', 'sfx', `${W} 場面 1 lines[1].sfxAfter`],
  ['error', 'lines', `${W} 場面 1 lines[2].bgm`],
  ['error', 'evidence', `${W} 場面 1 evidence`],
  ['error', 'tone', `${W} 場面 1 points.items[0].tone`],
  ['error', 'tone', `${W} 場面 2 terminal.entries[0].out[2].tone`],
];
