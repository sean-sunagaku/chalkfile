// 台詞を声にする設定（日本語は VOICEVOX、英語と中国語は Kokoro の話者と話し方）と、台詞ごとの音声ファイルの名前。
// synth.ts（合成）と materials.ts（素材の出し入れ）が同じ名前を使う。
import { createHash } from 'node:crypto';
import type { Lang, TranslatedLang } from '../content/i18n';
import { toSpeech, toSpeechZh } from '../content/reading';
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
  // 玄野武宏（ノーマル）: 天の声（淡々と、真実や先のことをばらすナレーション）。青山龍星（しっとり）は聞きにくかった
  tennokoe: { speaker: 11, speed: 1.02, intonation: 1.1, pitch: 0, credit: 'VOICEVOX:玄野武宏' },
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

/* ───────────── 英語と中国語の声（Kokoro） ─────────────
 * Kokoro-82M（hexgrad・Apache-2.0）を手元で動かす（scripts/tts_kokoro.py）。英語は v1.0、中国語は v1.1-zh のモデル。
 * v1.1-zh の中国語の声は、データ会社の LongMaoData が許諾したデータで学習したもの（モデルカード）。
 * 声は 2026-11-02 に、同じ文を全部の候補で読ませて、Whisper（medium）の聞き取りと声の高さを比べて選んだ。
 * 掛け合いの役が声で聞き分けられるように、先生・ボケ・天の声・呼び込みを違う話者にする。
 */
export type KokoroVoice = {
  engine: 'kokoro';
  /** Hugging Face のモデル（重みは Apache-2.0） */
  repo: 'hexgrad/Kokoro-82M' | 'hexgrad/Kokoro-82M-v1.1-zh';
  voice: string;
  /** 読みの作り方（misaki）。a: アメリカ英語、b: イギリス英語、z: 中国語 */
  g2p: 'a' | 'b' | 'z';
  speed: number;
};

const EN = 'hexgrad/Kokoro-82M' as const;
const ZH = 'hexgrad/Kokoro-82M-v1.1-zh' as const;
export const KOKORO: Record<TranslatedLang, Record<VoiceId, KokoroVoice>> = {
  en: {
    // 先生: af_heart（候補で一番自然。ツッコミは少し速く）
    narrator: { engine: 'kokoro', repo: EN, voice: 'af_heart', g2p: 'a', speed: 1.0 },
    tsukkomi: { engine: 'kokoro', repo: EN, voice: 'af_heart', g2p: 'a', speed: 1.1 },
    // ずんだもん: af_bella（高くて明るい声。先生と聞き分けられる）
    zundamon: { engine: 'kokoro', repo: EN, voice: 'af_bella', g2p: 'a', speed: 1.08 },
    'zundamon-cry': { engine: 'kokoro', repo: EN, voice: 'af_bella', g2p: 'a', speed: 0.9 },
    // 天の声: bm_george（落ち着いたイギリス英語の男性。淡々とばらす）
    tennokoe: { engine: 'kokoro', repo: EN, voice: 'bm_george', g2p: 'b', speed: 0.98 },
    // 呼び込み: am_fenrir（低めの男性）
    announcer: { engine: 'kokoro', repo: EN, voice: 'am_fenrir', g2p: 'a', speed: 1.0 },
  },
  zh: {
    // 先生: zf_019（落ち着いた女性。句読点の間がはっきりしていた）
    narrator: { engine: 'kokoro', repo: ZH, voice: 'zf_019', g2p: 'z', speed: 1.0 },
    tsukkomi: { engine: 'kokoro', repo: ZH, voice: 'zf_019', g2p: 'z', speed: 1.1 },
    // 俊达萌（ずんだもん）: zf_092（高くて明るい声）
    zundamon: { engine: 'kokoro', repo: ZH, voice: 'zf_092', g2p: 'z', speed: 1.05 },
    'zundamon-cry': { engine: 'kokoro', repo: ZH, voice: 'zf_092', g2p: 'z', speed: 0.9 },
    // 旁白（天の声）: zm_031（落ち着いた男性。淡々とばらす）
    tennokoe: { engine: 'kokoro', repo: ZH, voice: 'zm_031', g2p: 'z', speed: 0.98 },
    // 呼び込み: zm_029（候補で一番低い男性）
    announcer: { engine: 'kokoro', repo: ZH, voice: 'zm_029', g2p: 'z', speed: 1.0 },
  },
};

/** 言語ごとの声のクレジット（使った声だけ）。Kokoro はモデルごとに 1 つにまとめる */
export const creditsIn = (lang: Lang, voices: Iterable<VoiceId>): string[] => {
  if (lang === 'ja') return creditsOf(voices);
  const used = new Set(voices);
  const list = (Object.keys(KOKORO[lang]) as VoiceId[]).filter((v) => used.has(v)).map((v) => KOKORO[lang][v]);
  const byRepo = new Map<string, string[]>();
  for (const v of list) byRepo.set(v.repo, [...new Set([...(byRepo.get(v.repo) ?? []), v.voice])]);
  return [...byRepo].map(([repo, names]) => `Kokoro-82M${repo.endsWith('v1.1-zh') ? '-v1.1-zh' : ''} (${names.join(', ')})`);
};

/** 読み上げる文。日本語は英字をカナに開き（reading.ts）、英語と中国語は s か t を読む（強調の ** は外す。中国語は多音字を直す） */
export const speechIn = (line: Line, lang: Lang): string => {
  if (lang === 'ja') return speechOf(line);
  const s = (line.s ?? line.t).replace(/\*\*/g, '').trim();
  if (!s) throw new Error(`読み上げる文が空: ${line.t}`);
  return lang === 'zh' ? toSpeechZh(s) : s;
};

/** 英語と中国語の台詞の音声ファイルの名前（v1・凍結）。文と Kokoro の設定から作る（言語をまたいで重ならない） */
export const kokoroKeyV1 = (text: string, voice: VoiceId, lang: TranslatedLang): string =>
  createHash('sha1').update(JSON.stringify([text, KOKORO[lang][voice]])).digest('hex').slice(0, 16);

/** 台詞の音声ファイルの名前。日本語は VOICEVOX の名前（ttsKeyV1）、ほかは Kokoro の名前（kokoroKeyV1） */
export const ttsKeyIn = (text: string, voice: VoiceId, lang: Lang): string =>
  lang === 'ja' ? ttsKeyV1(text, voice) : kokoroKeyV1(text, voice, lang);
