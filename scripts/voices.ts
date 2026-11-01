// 台詞を声にする設定（VOICEVOX の話者と話し方）と、台詞ごとの音声ファイルの名前。
// synth.ts（合成）と materials.ts（素材の出し入れ）が同じ名前を使う。
import { createHash } from 'node:crypto';
import { toSpeech } from '../content/reading';
import type { Line, VoiceId } from '../content/types';

export const VOICES: Record<VoiceId, { speaker: number; speed: number; intonation: number; pitch: number; credit: string }> = {
  // No.7（ノーマル）: 講師。Whisper での聞き取りが候補の中で一番正確だった
  narrator: { speaker: 29, speed: 1.06, intonation: 1.12, pitch: 0, credit: 'VOICEVOX:No.7' },
  // 青山龍星（ノーマル）: レクチャー名の呼び込み
  announcer: { speaker: 13, speed: 1.0, intonation: 1.25, pitch: 0, credit: 'VOICEVOX:青山龍星' },
  // ここから、お笑い版の掛け合いの声
  // ずんだもん（ノーマル）: ボケ
  zundamon: { speaker: 3, speed: 1.08, intonation: 1.2, pitch: 0, credit: 'VOICEVOX:ずんだもん' },
  // ずんだもん（なみだめ）: ボケがへこんだとき
  'zundamon-cry': { speaker: 76, speed: 1.0, intonation: 1.1, pitch: 0, credit: 'VOICEVOX:ずんだもん' },
  // No.7（ノーマル）を少し速く、抑揚を強く: 講師の声で短く刺すツッコミ
  tsukkomi: { speaker: 29, speed: 1.14, intonation: 1.3, pitch: 0, credit: 'VOICEVOX:No.7' },
  // 青山龍星（しっとり）: 天の声（淡々と、真実や先のことをばらすナレーション）
  tennokoe: { speaker: 84, speed: 0.98, intonation: 1.0, pitch: 0, credit: 'VOICEVOX:青山龍星' },
};

/** 講座サイトのクレジットに出す声（全講座で共通の講師と呼び込み）。ほかの声を使う講座は、講座の sourceNote にも書く */
export const SITE_CREDITS: string[] = [...new Set([VOICES.narrator.credit, VOICES.announcer.credit])];

/** レクチャーで使った声のクレジット（VOICES の順・重なりなし）。動画のエンディングに出す */
export const creditsOf = (voices: Iterable<VoiceId>): string[] => {
  const used = new Set(voices);
  return [...new Set((Object.keys(VOICES) as VoiceId[]).filter((v) => used.has(v)).map((v) => VOICES[v].credit))];
};

/** 読み上げる文（英字はカナに開く）。英字が残ったら止める */
export const speechOf = (line: Line): string => {
  const s = toSpeech(line.s ?? line.t);
  if (/[A-Za-z]/.test(s)) throw new Error(`英字が残っている: ${s}`);
  return s;
};

/** 台詞の音声ファイルの名前（.work/tts/<key>.wav）。同じ文・同じ声なら同じ名前になり、前に作った音声を使い回す */
export const ttsKey = (text: string, voice: VoiceId): string =>
  createHash('sha1').update(JSON.stringify([text, VOICES[voice]])).digest('hex').slice(0, 16);
