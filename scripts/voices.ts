// 台詞ごとの音声ファイルの名前（声の鍵）。synth.ts（合成）・materials.ts（素材の出し入れ）・snapshots.ts（スナップショット）が同じ名前を使う。
// 鍵には 2 つの版がある。探すときは v2 → v1 の順に見て、新しく合成する声には v2 の鍵を付ける（ttsKeysIn）:
//   v2: 合成のレシピ（エンジン・話者・話し方・音量・前後の無音・出力の形。表示用のクレジットは入れない）から作る
//   v1: 前の作り方（凍結）。素材のブランチの今の声は、この名前で置いてある。合成のレシピが v1 のときと同じ声だけに使う
//       （声の設定を変えた声は、v1 の音声を使わない）。v1 の計算は、凍結した VOICES_V1・KOKORO_V1 から作る
// 別の版の台本から鍵を作るとき（materials.ts gc の --keep）も、このファイルを取り出して読むので、node: と content/ だけを読む
import { createHash } from 'node:crypto';
import type { Lang, TranslatedLang } from '../content/i18n';
import type { VoiceId } from '../content/types';
import { KOKORO, type KokoroVoice, VOICES } from '../content/voices';

/* ───────────── 合成のレシピ（v2 の鍵の入力） ───────────── */

/** VOICEVOX の出力の設定（全部の声で共通。synthesis に渡す）。変えると、日本語の全部の台詞が新しい鍵になる（合成し直し） */
export const VOICEVOX_OUTPUT = { volumeScale: 1, pre: 0.08, post: 0.12, sampleRate: 48000, channels: 1 } as const;
/**
 * Kokoro の出力の後処理（scripts/tts_kokoro.py の SR_OUT・PRE・POST・TARGET_RMS_DB・PEAK_DB。tests/unit/voices.test.ts が照らす）。
 * Python の側を変えたら、ここも変える（訳の全部の台詞が新しい鍵になる）
 */
export const KOKORO_OUTPUT = { pre: 0.08, post: 0.12, sampleRate: 48000, channels: 1, rmsDb: -20, peakDb: -1 } as const;

type Numbers<T> = { -readonly [K in keyof T]: number };
/** VOICEVOX の合成のレシピ。engineVersion は、エンジンの版を決めた声だけ（決めなければ、版を変えても鍵は同じ） */
export type VoicevoxRecipe = {
  v: 2;
  engine: 'voicevox';
  speaker: number;
  speed: number;
  intonation: number;
  pitch: number;
  engineVersion?: string;
} & Numbers<typeof VOICEVOX_OUTPUT>;
/** Kokoro の合成のレシピ（model は Hugging Face のモデル、speaker は声の名前、g2p は読みの作り方） */
export type KokoroRecipe = {
  v: 2;
  engine: 'kokoro';
  model: string;
  speaker: string;
  g2p: string;
  speed: number;
  engineVersion?: string;
} & Numbers<typeof KOKORO_OUTPUT>;
export type Recipe = VoicevoxRecipe | KokoroRecipe;

/** VOICEVOX の声の設定（content/voices.ts の VOICES の 1 つ。credit などの表示の項目は読まない） */
type VoicevoxSetting = { speaker: number; speed: number; intonation: number; pitch: number; engineVersion?: string };

export const voicevoxRecipe = (v: VoicevoxSetting, output: Numbers<typeof VOICEVOX_OUTPUT> = VOICEVOX_OUTPUT): VoicevoxRecipe => ({
  v: 2,
  engine: 'voicevox',
  speaker: v.speaker,
  speed: v.speed,
  intonation: v.intonation,
  pitch: v.pitch,
  ...output,
  ...(v.engineVersion ? { engineVersion: v.engineVersion } : {}),
});
export const kokoroRecipe = (
  k: KokoroVoice & { engineVersion?: string },
  output: Numbers<typeof KOKORO_OUTPUT> = KOKORO_OUTPUT,
): KokoroRecipe => ({
  v: 2,
  engine: 'kokoro',
  model: k.repo,
  speaker: k.voice,
  g2p: k.g2p,
  speed: k.speed,
  ...output,
  ...(k.engineVersion ? { engineVersion: k.engineVersion } : {}),
});
/** 台詞の声の合成のレシピ（日本語は VOICEVOX、英語と中国語は Kokoro） */
export const recipeIn = (voice: VoiceId, lang: Lang): Recipe =>
  lang === 'ja' ? voicevoxRecipe(VOICES[voice]) : kokoroRecipe(KOKORO[lang][voice]);

/** キーを名前の順に並べた JSON（項目を足す順・書く順で、鍵が変わらない。値の無い項目は入れない） */
const canonical = (x: unknown): string => {
  if (Array.isArray(x)) return `[${x.map(canonical).join(',')}]`;
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    const keys = Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(x);
};
const sameRecipe = (a: Recipe, b: Recipe) => canonical(a) === canonical(b);

/** v2 の鍵: 読み上げる文と合成のレシピ（キーを並べた JSON）の sha256 の頭 16 字 */
export const ttsKeyV2 = (text: string, recipe: Recipe): string =>
  createHash('sha256').update(canonical([text, recipe])).digest('hex').slice(0, 16);

/* ───────────── v1（凍結） ───────────── */

/** v1 の鍵を作った日本語の声（2026-11-03 の content/voices.ts の VOICES を写した。項目の並びも credit の表記も鍵に入るので、変えない） */
const VOICES_V1: Readonly<Record<string, VoicevoxSetting & { credit: string }>> = {
  narrator: { speaker: 29, speed: 1.06, intonation: 1.12, pitch: 0, credit: 'VOICEVOX:No.7' },
  announcer: { speaker: 13, speed: 1.0, intonation: 1.25, pitch: 0, credit: 'VOICEVOX:青山龍星' },
  zundamon: { speaker: 3, speed: 1.08, intonation: 1.2, pitch: 0, credit: 'VOICEVOX:ずんだもん' },
  'zundamon-cry': { speaker: 76, speed: 1.0, intonation: 1.1, pitch: 0, credit: 'VOICEVOX:ずんだもん' },
  tsukkomi: { speaker: 29, speed: 1.14, intonation: 1.3, pitch: 0, credit: 'VOICEVOX:No.7' },
  tennokoe: { speaker: 11, speed: 1.02, intonation: 1.1, pitch: 0, credit: 'VOICEVOX:玄野武宏' },
};
const EN = 'hexgrad/Kokoro-82M' as const;
const ZH = 'hexgrad/Kokoro-82M-v1.1-zh' as const;
/** v1 の鍵を作った英語と中国語の声（2026-11-03 の KOKORO を写した。変えない） */
const KOKORO_V1: Readonly<Record<TranslatedLang, Readonly<Record<string, KokoroVoice>>>> = {
  en: {
    narrator: { engine: 'kokoro', repo: EN, voice: 'af_heart', g2p: 'a', speed: 1.0 },
    tsukkomi: { engine: 'kokoro', repo: EN, voice: 'af_heart', g2p: 'a', speed: 1.1 },
    zundamon: { engine: 'kokoro', repo: EN, voice: 'af_bella', g2p: 'a', speed: 1.08 },
    'zundamon-cry': { engine: 'kokoro', repo: EN, voice: 'af_bella', g2p: 'a', speed: 0.9 },
    tennokoe: { engine: 'kokoro', repo: EN, voice: 'bm_george', g2p: 'b', speed: 0.98 },
    announcer: { engine: 'kokoro', repo: EN, voice: 'am_fenrir', g2p: 'a', speed: 1.0 },
  },
  zh: {
    narrator: { engine: 'kokoro', repo: ZH, voice: 'zf_019', g2p: 'z', speed: 1.0 },
    tsukkomi: { engine: 'kokoro', repo: ZH, voice: 'zf_019', g2p: 'z', speed: 1.1 },
    zundamon: { engine: 'kokoro', repo: ZH, voice: 'zf_092', g2p: 'z', speed: 1.05 },
    'zundamon-cry': { engine: 'kokoro', repo: ZH, voice: 'zf_092', g2p: 'z', speed: 0.9 },
    tennokoe: { engine: 'kokoro', repo: ZH, voice: 'zm_031', g2p: 'z', speed: 0.98 },
    announcer: { engine: 'kokoro', repo: ZH, voice: 'zm_029', g2p: 'z', speed: 1.0 },
  },
};
/** v1 の声を作ったときの出力（synth.ts に書いてあった VOICEVOX の値と、scripts/tts_kokoro.py の後処理） */
const VOICEVOX_OUTPUT_V1 = { volumeScale: 1, pre: 0.08, post: 0.12, sampleRate: 48000, channels: 1 };
const KOKORO_OUTPUT_V1 = { pre: 0.08, post: 0.12, sampleRate: 48000, channels: 1, rmsDb: -20, peakDb: -1 };

const sha1Key = (value: unknown) => createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16);

/** v1 の鍵（凍結）: [文, VOICES_V1 の声] の sha1 の頭 16 字。v1 に無い声は null */
export const ttsKeyV1 = (text: string, voice: VoiceId): string | null => {
  const v = VOICES_V1[voice];
  return v ? sha1Key([text, v]) : null;
};
/** v1 の鍵（凍結）: [文, KOKORO_V1 の声] の sha1 の頭 16 字（言語をまたいで重ならない）。v1 に無い声は null */
export const kokoroKeyV1 = (text: string, voice: VoiceId, lang: TranslatedLang): string | null => {
  const k = KOKORO_V1[lang][voice];
  return k ? sha1Key([text, k]) : null;
};

/** v1 の声の合成のレシピ（v1 に無い声は null） */
const recipeV1In = (voice: VoiceId, lang: Lang): Recipe | null => {
  if (lang === 'ja') {
    const v = VOICES_V1[voice];
    return v ? voicevoxRecipe(v, VOICEVOX_OUTPUT_V1) : null;
  }
  const k = KOKORO_V1[lang][voice];
  return k ? kokoroRecipe(k, KOKORO_OUTPUT_V1) : null;
};

/* ───────────── 探す鍵 ───────────── */

/** v1 の鍵。声の合成のレシピが v1 のときと同じ声だけ（設定を変えた声・v1 に無い声は null） */
export const ttsKeyV1In = (text: string, voice: VoiceId, lang: Lang, recipe: Recipe = recipeIn(voice, lang)): string | null => {
  const old = recipeV1In(voice, lang);
  if (!old || !sameRecipe(old, recipe)) return null;
  return lang === 'ja' ? ttsKeyV1(text, voice) : kokoroKeyV1(text, voice, lang);
};

/**
 * 台詞の音声を探す鍵（この順に探す。v2、あれば v1）。先頭（v2）が、新しく合成する声の名前。
 * recipe を渡すと、その設定で求める（テストで、声の設定を変えたときの鍵を見る）
 */
export const ttsKeysIn = (text: string, voice: VoiceId, lang: Lang, recipe: Recipe = recipeIn(voice, lang)): [string, ...string[]] => {
  const v1 = ttsKeyV1In(text, voice, lang, recipe);
  const v2 = ttsKeyV2(text, recipe);
  return v1 ? [v2, v1] : [v2];
};
