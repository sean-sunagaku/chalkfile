// 声の一覧（日本語は VOICEVOX、英語と中国語は Kokoro の話者と話し方）と、声のクレジット・読み上げる文。
// 純粋なデータと関数だけを置く（Node・React・Remotion に依存しない）。動画（Remotion）・サイトの組み立て・synth が同じものを読む（content/voices.ts から読んでもよい。再 export）。
// 台詞ごとの音声ファイルの名前（鍵。合成のレシピから node:crypto で作る）は scripts/voices.ts
import type { Lang, TranslatedLang } from './i18n';
import { readingOf, toSpeech, toSpeechZh } from './reading';
import type { Lecture, Line, VoiceId } from './schema';

/**
 * 日本語の声（VOICEVOX）。合成の設定（speaker・speed・intonation・pitch）は声の鍵（scripts/voices.ts の合成のレシピ）に入り、
 * 変えた声は新しい鍵になる（合成し直し）。credit は表示だけで、鍵には入らない。どの項目も timeline の指紋には入るので、
 * 変えたら npm run synth -- --cached-only で timeline を作り直す。動かしたら tests/speech-snapshot.test.ts で、鍵を確かめる
 */
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

/** レクチャーで使った声のクレジット（VOICES の順・重なりなし）。動画のエンディングに出す */
export const creditsOf = (voices: Iterable<VoiceId>): string[] => {
  const used = new Set(voices);
  return [...new Set((Object.keys(VOICES) as VoiceId[]).filter((v) => used.has(v)).map((v) => VOICES[v].credit))];
};

/* ───────────── 英語と中国語の声（Kokoro） ─────────────
 * Kokoro-82M（hexgrad・Apache-2.0）を手元で動かす（scripts/tts_kokoro.py）。英語は v1.0、中国語は v1.1-zh のモデル。
 * v1.1-zh の中国語の声は、データ会社の LongMaoData が許諾したデータで学習したもの（モデルカード）。
 * 声は 2026-11-02 に、同じ文を全部の候補で読ませて、Whisper（medium）の聞き取りと声の高さを比べて選んだ。
 * 掛け合いの役が声で聞き分けられるように、先生・ボケ・天の声・呼び込みを違う話者にする。
 * repo・voice・g2p・speed は声の鍵（scripts/voices.ts の合成のレシピ）に入る
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

/** レクチャーの全部の台詞の声（台詞の順。v が無ければ講師） */
export const voicesOf = (lecture: Lecture): VoiceId[] => lecture.scenes.flatMap((s) => s.lines.map((l) => l.v ?? 'narrator'));

/** 動画の終わりに出すクレジット（その動画で使った声だけ）。訳の動画は、訳を重ねたあとのレクチャーと、その言語を渡す */
export const lectureCredits = (lecture: Lecture, lang: Lang): string[] => creditsIn(lang, voicesOf(lecture));

/* ───────────── 読み上げる文 ───────────── */

/** 読み上げる文（英字はカナに開く）。台詞の講座の辞書（content/<講座>/reading.ts）と共通の辞書で読む。英字が残ったら止める */
export const speechOf = (line: Line): string => {
  const s = toSpeech(line.s ?? line.t, readingOf(line));
  if (/[A-Za-z]/.test(s)) throw new Error(`英字が残っている: ${s}`);
  return s;
};

/** 読み上げる文。日本語は英字をカナに開き（engine/core/reading.ts の共通の辞書と講座の辞書）、英語と中国語は s か t を読む（強調の ** は外す。中国語は多音字を直す） */
export const speechIn = (line: Line, lang: Lang): string => {
  if (lang === 'ja') return speechOf(line);
  const s = (line.s ?? line.t).replace(/\*\*/g, '').trim();
  if (!s) throw new Error(`読み上げる文が空: ${line.t}`);
  return lang === 'zh' ? toSpeechZh(s) : s;
};
