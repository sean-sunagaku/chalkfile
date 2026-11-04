// 声の鍵（scripts/voices.ts）。v2 は合成のレシピから作り、表示用のクレジットでは変わらず、合成の設定で変わる。
// 探す順は v2 → v1 で、v1 は合成のレシピが v1 のときと同じ声だけに使う。v1 の値そのものは、スナップショット（tests/unit/speech-snapshot.test.ts）が守る
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { VoiceId } from '../../content/types';
import { KOKORO, VOICES } from '../../content/voices';
import {
  KOKORO_OUTPUT,
  kokoroRecipe,
  type Recipe,
  recipeIn,
  ttsKeysIn,
  ttsKeyV1,
  ttsKeyV1In,
  ttsKeyV2,
  VOICEVOX_OUTPUT,
  voicevoxRecipe,
} from '../../scripts/voices';

const ROOT = path.resolve(import.meta.dir, '../..');
const JA = 'こんにちは。';

describe('合成のレシピ（v2 の鍵の入力）', () => {
  test('VOICEVOX は話者・話し方と出力の形（音量・前後の無音・48kHz・モノラル）。表示用の credit は入れない', () => {
    expect(recipeIn('narrator', 'ja')).toEqual({
      v: 2,
      engine: 'voicevox',
      speaker: 29,
      speed: 1.06,
      intonation: 1.12,
      pitch: 0,
      volumeScale: 1,
      pre: 0.08,
      post: 0.12,
      sampleRate: 48000,
      channels: 1,
    });
  });
  test('Kokoro はモデル・声・読みの作り方・速さと、後処理（前後の無音・48kHz・モノラル・声の大きさ）', () => {
    expect(recipeIn('tennokoe', 'en')).toEqual({
      v: 2,
      engine: 'kokoro',
      model: 'hexgrad/Kokoro-82M',
      speaker: 'bm_george',
      g2p: 'b',
      speed: 0.98,
      pre: 0.08,
      post: 0.12,
      sampleRate: 48000,
      channels: 1,
      rmsDb: -20,
      peakDb: -1,
    });
  });
  test('Kokoro の後処理の値は、scripts/tts_kokoro.py の値と同じ（Python を変えたら、レシピも変える）', () => {
    const py = readFileSync(path.join(ROOT, 'scripts/tts_kokoro.py'), 'utf8');
    const num = (name: string) => Number(new RegExp(`^${name} = (-?[\\d.]+)`, 'm').exec(py)?.[1]);
    expect({
      pre: num('PRE'),
      post: num('POST'),
      sampleRate: num('SR_OUT'),
      rmsDb: num('TARGET_RMS_DB'),
      peakDb: num('PEAK_DB'),
    }).toEqual({
      pre: KOKORO_OUTPUT.pre,
      post: KOKORO_OUTPUT.post,
      sampleRate: KOKORO_OUTPUT.sampleRate,
      rmsDb: KOKORO_OUTPUT.rmsDb,
      peakDb: KOKORO_OUTPUT.peakDb,
    });
    // モノラルで書く（sf.write に 1 本の音を渡す）
    expect(KOKORO_OUTPUT.channels).toBe(1);
  });
});

describe('v2 の鍵', () => {
  test('正解の値（文とレシピの sha256 の頭 16 字。作り方を変えると、v2 で作った全部の声が見つからなくなる）', () => {
    expect(ttsKeyV2(JA, recipeIn('narrator', 'ja'))).toBe('db17cda33f9fcc72');
    expect(ttsKeyV2('Hello.', recipeIn('narrator', 'en'))).toBe('7b60b208e51945f1');
    expect(ttsKeyV2('你好。', recipeIn('tennokoe', 'zh'))).toBe('ebe751d5ec769514');
  });
  test('レシピの項目の並びでは変わらない', () => {
    const r = recipeIn('narrator', 'ja');
    const reversed = Object.fromEntries(Object.entries(r).reverse()) as Recipe;
    expect(ttsKeyV2(JA, reversed)).toBe(ttsKeyV2(JA, r));
  });
});

describe('探す鍵（v2 → v1）', () => {
  test('今の声は、v2 と v1 の 2 つを探す（v1 は前の作り方の鍵と同じ）', () => {
    expect(ttsKeysIn(JA, 'narrator', 'ja')).toEqual(['db17cda33f9fcc72', '3e81eb37b43eac19']);
    expect(ttsKeysIn('Hello.', 'narrator', 'en')).toEqual(['7b60b208e51945f1', '482bacdabe2ab776']);
    expect(ttsKeysIn('你好。', 'tennokoe', 'zh')).toEqual(['ebe751d5ec769514', '5a89f21d85da9c7b']);
    expect(ttsKeyV1(JA, 'narrator')).toBe('3e81eb37b43eac19');
  });
  test('credit（表示用の項目）を直しても、v2 も v1 も変わらない（キャッシュが外れない）', () => {
    for (const voice of Object.keys(VOICES) as VoiceId[]) {
      const now = ttsKeysIn(JA, voice, 'ja');
      const renamed = voicevoxRecipe({ ...VOICES[voice], credit: `${VOICES[voice].credit}（ノーマル）` } as never);
      expect(ttsKeysIn(JA, voice, 'ja', renamed)).toEqual(now);
      expect(now).toHaveLength(2);
    }
    // Kokoro に表示用の項目を足しても、変わらない
    const labeled = kokoroRecipe({ ...KOKORO.en.narrator, label: '先生' } as never);
    expect(ttsKeysIn('Hello.', 'narrator', 'en', labeled)).toEqual(ttsKeysIn('Hello.', 'narrator', 'en'));
  });
  test('合成の設定を変えたら、新しい v2 の鍵になり、v1 の音声は使わない', () => {
    const now = ttsKeysIn(JA, 'narrator', 'ja');
    const changed: Recipe[] = [
      voicevoxRecipe({ ...VOICES.narrator, speed: 1.1 }),
      voicevoxRecipe({ ...VOICES.narrator, speaker: 30 }),
      voicevoxRecipe({ ...VOICES.narrator, intonation: 1.2 }),
      voicevoxRecipe({ ...VOICES.narrator, pitch: 0.05 }),
      voicevoxRecipe(VOICES.narrator, { ...VOICEVOX_OUTPUT, volumeScale: 1.2 }),
      voicevoxRecipe(VOICES.narrator, { ...VOICEVOX_OUTPUT, pre: 0.1 }),
      voicevoxRecipe(VOICES.narrator, { ...VOICEVOX_OUTPUT, post: 0.2 }),
      voicevoxRecipe(VOICES.narrator, { ...VOICEVOX_OUTPUT, sampleRate: 44100 }),
      voicevoxRecipe(VOICES.narrator, { ...VOICEVOX_OUTPUT, channels: 2 }),
      // エンジンの版を決めた声も、別の鍵になる（どの版の音か分からない v1 の音声は使わない）
      voicevoxRecipe({ ...VOICES.narrator, engineVersion: '0.25.0' }),
    ];
    const keys = changed.map((r) => ttsKeysIn(JA, 'narrator', 'ja', r));
    for (const k of keys) {
      expect(k).toHaveLength(1);
      expect(k[0]).not.toBe(now[0]);
    }
    expect(new Set(keys.map((k) => k[0])).size).toBe(changed.length);
    // Kokoro の後処理を変えても
    const kokoro = ttsKeysIn(
      'Hello.',
      'narrator',
      'en',
      kokoroRecipe(KOKORO.en.narrator, { ...KOKORO_OUTPUT, rmsDb: -18 }),
    );
    expect(kokoro).toHaveLength(1);
    expect(kokoro[0]).not.toBe(ttsKeysIn('Hello.', 'narrator', 'en')[0]);
  });
  test('v1 に無い声（あとで足した声）は、v2 だけ', () => {
    expect(ttsKeyV1In(JA, 'guest' as VoiceId, 'ja', recipeIn('narrator', 'ja'))).toBeNull();
    expect(ttsKeyV1(JA, 'guest' as VoiceId)).toBeNull();
  });
});
