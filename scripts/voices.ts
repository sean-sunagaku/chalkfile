// 台詞ごとの音声ファイルの名前（鍵）。synth.ts（合成）と materials.ts（素材の出し入れ）が同じ名前を使う。
// 鍵は node:crypto で作るので、ここに置く（Remotion からは読まない）。声の一覧・クレジット・読み上げる文は content/voices.ts
import { createHash } from 'node:crypto';
import type { Lang, TranslatedLang } from '../content/i18n';
import type { VoiceId } from '../content/types';
import { KOKORO, VOICES } from '../content/voices';

/**
 * 台詞の音声ファイルの名前（.work/tts/<key>.wav）。同じ文・同じ声なら同じ名前になり、前に作った音声を使い回す。
 * v1 の計算は凍結する（素材のブランチの音声はこの名前で置いてある）。VOICES の声の中身（credit の表記・項目の並び）も名前に入るので、
 * 声の設定を動かしたら、全台詞の名前が変わっていないかを tests/speech-snapshot.test.ts で確かめる
 */
export const ttsKeyV1 = (text: string, voice: VoiceId): string =>
  createHash('sha1').update(JSON.stringify([text, VOICES[voice]])).digest('hex').slice(0, 16);
/**
 * ttsKeyV1 の別名（今までの名前。素材の文書が scripts/voices.ts の ttsKey として指すので残す）
 * @public
 */
export const ttsKey = ttsKeyV1;

/** 英語と中国語の台詞の音声ファイルの名前（v1・凍結）。文と Kokoro の設定から作る（言語をまたいで重ならない） */
export const kokoroKeyV1 = (text: string, voice: VoiceId, lang: TranslatedLang): string =>
  createHash('sha1').update(JSON.stringify([text, KOKORO[lang][voice]])).digest('hex').slice(0, 16);

/** 台詞の音声ファイルの名前。日本語は VOICEVOX の名前（ttsKeyV1）、ほかは Kokoro の名前（kokoroKeyV1） */
export const ttsKeyIn = (text: string, voice: VoiceId, lang: Lang): string =>
  lang === 'ja' ? ttsKeyV1(text, voice) : kokoroKeyV1(text, voice, lang);
