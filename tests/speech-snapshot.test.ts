// 全台詞の音声の鍵・読み・訳の指紋（と動画の終わりのクレジット）が、tests/fixtures/snapshots と同じかを見る。
// 違ったら、変わった動画と台詞（何番目・どの値）を出す。わざと変えたなら bun scripts/snapshots.ts --update で作り直し、
// PR に「合成し直しが要る」と書く（tests/fixtures/snapshots/README.md）
import { describe, expect, test } from 'bun:test';
import { differences, MEANING, readSnapshot, snapshotOf, speechValues, type Category, type VideoValue } from '../scripts/snapshots';

const values = speechValues();
const diff = differences(readSnapshot(), values);
const same = (c: Category) => {
  const found = diff.found[c];
  if (found.length) throw new Error([`${MEANING[c].title}（tests/fixtures/snapshots と違う）`, ...found, `→ ${MEANING[c].then}`].join('\n'));
};

describe('音声の鍵・読み・訳の指紋のスナップショット', () => {
  test('動画が増えも減りもしていない（日本語の全講座と全部の訳）', () => same('videos'));
  test('音声の鍵（日本語は VOICEVOX の ttsKeyV1、訳は Kokoro の kokoroKeyV1）', () => same('keys'));
  test('読み（toSpeech・toSpeechZh。synth.ts と同じ speechIn）', () => same('speech'));
  test('訳の指紋（scripts/i18n.ts の stamp が書く値）', () => same('fingerprints'));
  test('動画の終わりのクレジット（VOICES の並び・credit の表記で変わる）', () => same('credits'));
  test('全体の数とハッシュ（summary.json）', () => same('summary'));

  test('網が効く: わざと変えた鍵・読み・指紋・クレジット・台詞・動画を見つける', () => {
    const base = snapshotOf(values);
    expect(Object.values(differences(base, values).found).flat()).toEqual([]);
    // クレジットが 2 つ以上ある動画で試す（並びの入れ替えを見る）
    const i = values.findIndex((v) => v.credits.length > 1);
    expect(i).toBeGreaterThanOrEqual(0);
    const cases: [Category, (v: VideoValue) => void][] = [
      ['keys', (v) => { v.lines[0].key = '0'.repeat(16); }],
      ['speech', (v) => { v.lines[0].speech += 'ね'; }],
      ['fingerprints', (v) => { v.fingerprint = '0'.repeat(12); }],
      ['credits', (v) => { v.credits.reverse(); }],
      ['keys', (v) => { v.lines.pop(); }],
    ];
    for (const [c, change] of cases) {
      const changed = structuredClone(values);
      change(changed[i]);
      const { found, resynth } = differences(base, changed);
      expect(found[c].join('\n')).toContain(values[i].video);
      expect(found.summary.length).toBeGreaterThan(0);
      if (c === 'keys') expect(resynth).toEqual([values[i].video]);
    }
    const { found } = differences(base, values.filter((_, k) => k !== i));
    expect(found.videos).toEqual([`${values[i].video}: 動画が無くなった`]);
  });
});
