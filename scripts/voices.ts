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
