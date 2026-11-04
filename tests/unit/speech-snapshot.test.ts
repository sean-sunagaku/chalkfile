// 全台詞の音声の鍵（v1 と v2）・読みと動画の終わりのクレジット、訳がある動画の訳の指紋が、tests/fixtures/snapshots/videos と同じかを見る。
// 違ったら、変わった動画と台詞（何番目・どの値）を出す。わざと変えたなら bun scripts/snapshots.ts --update で作り直し、
// PR に「合成し直しが要る」と書く（tests/fixtures/snapshots/README.md）
import { describe, expect, test } from 'bun:test';
import { parseVideoKey } from '../../content/i18n';
import {
  differences,
  MEANING,
  readSnapshot,
  snapshotOf,
  speechValues,
  type Category,
  type VideoValue,
} from '../../scripts/snapshots';

const values = speechValues();
const diff = differences(readSnapshot(), values);
const same = (c: Category) => {
  const found = diff.found[c];
  if (found.length)
    throw new Error(
      [`${MEANING[c].title}（tests/fixtures/snapshots と違う）`, ...found, `→ ${MEANING[c].next}`].join('\n'),
    );
};

describe('音声の鍵・読み・訳の指紋のスナップショット', () => {
  test('動画とファイルが 1 対 1（content/index.ts の VIDEOS と videos/<動画>.json）', () => same('videos'));
  test('音声の鍵（v1 は凍結した前の作り方、v2 は合成のレシピから。scripts/voices.ts）', () => same('keys'));
  test('読み（toSpeech・toSpeechZh。synth.ts と同じ speechIn）', () => same('speech'));
  test('訳の指紋（訳がある動画だけ。scripts/i18n.ts の stamp が書く値）', () => same('fingerprints'));
  test('動画の終わりのクレジット（VOICES の並び・credit の表記で変わる）', () => same('credits'));
  test('鍵の一覧（全部の動画・重なりなし。動画ごとのファイルから求める）', () => same('keyList'));

  test('訳の指紋を持つのは、訳の動画と、訳がある日本語の動画だけ（訳の無い台本は画面を直しても作り直さない）', () => {
    const translated = new Set(
      values.filter((v) => parseVideoKey(v.video).lang !== 'ja').map((v) => parseVideoKey(v.video).id),
    );
    expect(translated.size).toBeGreaterThan(0);
    for (const v of values)
      expect(`${v.video} ${!!v.fingerprint}`).toBe(`${v.video} ${translated.has(parseVideoKey(v.video).id)}`);
  });

  test('網が効く: わざと変えた鍵・読み・指紋・クレジット・台詞・動画を見つける', () => {
    const base = snapshotOf(values);
    expect(Object.values(differences(base, values).found).flat()).toEqual([]);
    // 訳の指紋とクレジット 2 つ以上を持つ動画で試す（クレジットは並びの入れ替えを見る）
    const i = values.findIndex((v) => v.fingerprint && v.credits.length > 1);
    expect(i).toBeGreaterThanOrEqual(0);
    const video = values[i].video;
    const cases: [Category, (v: VideoValue) => void][] = [
      [
        'keys',
        (v) => {
          v.lines[0].v1 = '0'.repeat(16);
        },
      ],
      [
        'keys',
        (v) => {
          v.lines[0].v2 = 'f'.repeat(16);
        },
      ],
      [
        'keys',
        (v) => {
          v.lines[0].v1 = null;
        },
      ],
      [
        'speech',
        (v) => {
          v.lines[0].speech += 'ね';
        },
      ],
      [
        'fingerprints',
        (v) => {
          v.fingerprint = '0'.repeat(12);
        },
      ],
      [
        'credits',
        (v) => {
          v.credits.reverse();
        },
      ],
      [
        'keys',
        (v) => {
          v.lines.pop();
        },
      ],
    ];
    for (const [c, change] of cases) {
      const changed = structuredClone(values);
      change(changed[i]);
      expect(differences(base, changed).found[c].join('\n')).toContain(video);
    }
    // v1 も v2 もスナップショットに無い台詞は、合成が要る動画として数える
    const changed = structuredClone(values);
    changed[i].lines[0].v1 = '0'.repeat(16);
    changed[i].lines[0].v2 = 'f'.repeat(16);
    const d = differences(base, changed);
    expect(d.resynth).toEqual([`${video}（1）`]);
    expect(d.found.keyList.join('\n')).toContain('スナップショットに無い鍵の台詞 1（合成が要る');
    // v2 だけが変わっても、v1 の音声が当たるなら合成は要らない
    const v2only = structuredClone(values);
    v2only[i].lines[0].v2 = 'f'.repeat(16);
    const d2 = differences(base, v2only);
    expect(d2.resynth).toEqual([]);
    expect(d2.found.keyList.join('\n')).toContain('台詞の声は、ほかの鍵で当たる');
    // 動画のファイルが無い・残っている
    const without = new Map([...base].filter(([k]) => k !== video));
    expect(differences(without, values).found.videos.join('\n')).toContain(`${video}: videos/${video}.json が無い`);
    expect(
      differences(
        base,
        values.filter((_, k) => k !== i),
      ).found.videos,
    ).toEqual([`${video}: 動画が無いのに videos/${video}.json が残っている`]);
  });
});
