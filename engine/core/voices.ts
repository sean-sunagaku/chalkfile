// 声の一覧（日本語は VOICEVOX、英語と中国語は Kokoro の話者と話し方）と、声のクレジット・読み上げる文。
// 純粋なデータと関数だけを置く（Node・React・Remotion に依存しない）。動画（Remotion）・サイトの組み立て・synth が同じものを読む（content/voices.ts から読んでもよい。再 export）。
// 台詞ごとの音声ファイルの名前（鍵。合成のレシピから node:crypto で作る）は scripts/voices.ts
import type { KokoroVoice, VoicevoxVoice } from './project-config';
import { KOKORO as SETTINGS_KOKORO, VOICES as SETTINGS_VOICES } from './project-settings';
import type { Lang, TranslatedLang } from './i18n';
import { readingOf, toSpeech, toSpeechZh } from './reading';
import type { Lecture, Line, VoiceId } from './schema';

/**
 * 日本語の声（VOICEVOX）。合成の設定（speaker・speed・intonation・pitch）は声の鍵（scripts/voices.ts の合成のレシピ）に入り、
 * 変えた声は新しい鍵になる（合成し直し）。credit は表示だけで、鍵には入らない。どの項目も timeline の指紋には入るので、
 * 変えたら npm run synth -- --cached-only で timeline を作り直す。動かしたら tests/unit/speech-snapshot.test.ts で、鍵を確かめる
 */
export const VOICES: Record<VoiceId, VoicevoxVoice> = SETTINGS_VOICES;

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
export type { KokoroVoice } from './project-config';
export const KOKORO: Record<TranslatedLang, Record<VoiceId, KokoroVoice>> = SETTINGS_KOKORO;

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
