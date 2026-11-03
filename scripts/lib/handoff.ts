// TS の道具が書き、Python の道具が読む JSON（受け渡し）の形と版。書く側はこの型で書き、schema に SCHEMA の数を入れる。
// Python の側は scripts/audio/handoff.py が、読むときに同じ形かを確かめる（足りない項目・違う型・知らない効果音・違う版を、読める文で止める）。
//   Plan        .work/plan/<動画>.json      scripts/synth.ts が書き、scripts/mix.py が読む（ミックスの設計図）
//   Speech      .work/speech/<動画>.json    scripts/synth.ts が書き、scripts/check_speech.py が読む（訳の台詞と音声の対応）
//   KokoroJobs  一時のフォルダの jobs.json   scripts/synth.ts が書き、scripts/tts_kokoro.py が読む（Kokoro に読ませる台詞）
//   SfxList     scripts/audio/sfx.json      npm run gen が content/sfx.ts から書き（Git に入れる）、scripts/mix.py・build_music.py が読む
// 形を変えたら、ここと handoff.py の SCHEMA の数を 1 つ上げる。tests/handoff.test.ts が、この型で書いたものを handoff.py で読めるかと、
// 数が同じかを確かめる
import type { TranslatedLang } from '../../content/i18n';
import { SFX } from '../../content/sfx';
import type { Line, Scene, SfxId, VoiceId } from '../../content/types';
import type { KokoroVoice } from '../../content/voices';

/** 受け渡しの形の版（形を変えたら 1 つ上げる。scripts/audio/handoff.py の SCHEMA と同じにする） */
export const SCHEMA = { plan: 1, speech: 1, kokoroJobs: 1, sfx: 1 } as const;

/** ミックスの設計図の台詞。時刻は動画の頭からの秒。音声は場所に縛られない名前（.work/tts/<鍵>.wav） */
export type PlanLine = {
  file: string;
  start: number;
  end: number;
  /** 次の台詞までの間（秒） */
  pauseAfter: number;
  sfx?: SfxId;
  sfxAfter?: SfxId;
  bgm?: Line['bgm'];
};
export type PlanScene = { kind: Scene['kind']; start: number; end: number; lines: PlanLine[] };
/** ミックスの設計図（.work/plan/<動画>.json）。id は動画の名前（ファイルの名前と同じ） */
export type Plan = { schema: typeof SCHEMA.plan; id: string; duration: number; scenes: PlanScene[] };

/** 聞き取りの点検の台詞。at は s<場面>-<台詞>（1 始まり）、t は画面の文、speech は読ませた文 */
export type SpeechLine = { at: string; voice: VoiceId; t: string; speech: string; file: string };
/** 訳の台詞と音声の対応（.work/speech/<動画>.json） */
export type Speech = { schema: typeof SCHEMA.speech; key: string; lang: TranslatedLang; lines: SpeechLine[] };

/** Kokoro に読ませる台詞 1 本。key は音声の鍵、声の項目は content/voices.ts の KOKORO のもの */
export type KokoroJob = { key: string; text: string } & KokoroVoice;
/** Kokoro の仕事（一時のフォルダの jobs.json） */
export type KokoroJobs = { schema: typeof SCHEMA.kokoroJobs; jobs: KokoroJob[] };

/** 効果音の一覧（scripts/audio/sfx.json）。db はミックスでの音量 */
export type SfxList = { _note: string; schema: typeof SCHEMA.sfx; sfx: Record<SfxId, { db: number }> };

/** 効果音の一覧の書き出し先（リポジトリの直下からのパス） */
export const SFX_JSON = 'scripts/audio/sfx.json';

/** 効果音の一覧の中身（npm run gen が書く。JSON はコメントを書けないので、作り方を _note に書く） */
export const sfxJson = (): string => {
  const list: SfxList = {
    _note: 'content/sfx.ts から npm run gen（bun scripts/gen.ts）で作る。手で直さない',
    schema: SCHEMA.sfx,
    sfx: Object.fromEntries(Object.entries(SFX).map(([name, s]) => [name, { db: s.db }])) as SfxList['sfx'],
  };
  return `${JSON.stringify(list, null, 2)}\n`;
};
