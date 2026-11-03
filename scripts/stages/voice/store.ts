// 台詞の音声と読み（<鍵>.wav・<鍵>.kana）と、声の記録（<鍵>.meta.json）の置き場所（声のキャッシュ）。
// 書くのは作業フォルダの間で共有のキャッシュ（<キャッシュ>/tts。scripts/lib/paths.ts の ttsDirs）。読むときは、先に共有のキャッシュ、
// 無ければ作業フォルダの .work/tts（前の置き場所）も探す。音声と読みが同じフォルダにそろっているものだけを使う。
// 声の記録は、読みの隣に置く（どの合成のレシピと、どのエンジンの版で作ったか）。v2 の鍵で作った声だけが持つ（v1 の声には無い）
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { writeAtomic } from '../../lib/fsx';
import { TTS_REL } from '../../lib/paths';
import { wavSeconds } from '../../lib/wav';
import type { Recipe } from '../../voices';
import type { LineVoice } from '../timeline/compute';

/** 声の置き場所。書くのは cache、読むときは cache → local の順 */
export type VoiceStore = { cache: string; local: string };

/** 声の記録（<鍵>.meta.json）。text は読み上げた文、engineVersion は作ったエンジンの版（VOICEVOX は 0.25.0 のような版） */
export type VoiceMeta = { schema: 1; key: string; text: string; recipe: Recipe; engineVersion: string };

/** 見つけた声（key はファイルの名前の鍵。meta は声の記録で、v1 の声には無い） */
export type Voice = LineVoice & { key: string; meta?: VoiceMeta };

/** 声の記録の中身（キーの並びも含めて決まった形。同じ声なら同じバイト列） */
export const metaJson = (m: VoiceMeta): string =>
  `${JSON.stringify({ schema: m.schema, key: m.key, text: m.text, recipe: m.recipe, engineVersion: m.engineVersion }, null, 1)}\n`;

/** 声の記録を読む。無い・読めない・形が違うときは undefined（声は記録が無くても使える） */
export const readMeta = (dir: string, key: string): VoiceMeta | undefined => {
  const file = path.join(dir, `${key}.meta.json`);
  if (!existsSync(file)) return undefined;
  try {
    const m = JSON.parse(readFileSync(file, 'utf8')) as Partial<VoiceMeta>;
    return m.schema === 1 && m.key === key && typeof m.engineVersion === 'string' ? (m as VoiceMeta) : undefined;
  } catch {
    return undefined;
  }
};

/** keys（探す順）のうち、音声と読みが同じフォルダにそろっている最初の鍵と、そのフォルダ */
export const findVoice = (store: VoiceStore, keys: string[]): { key: string; dir: string } | null => {
  for (const key of keys) {
    const dir = [store.cache, store.local].find(
      (d) => existsSync(path.join(d, `${key}.wav`)) && existsSync(path.join(d, `${key}.kana`)),
    );
    if (dir) return { key, dir };
  }
  return null;
};

/** 作ってある声。音声は、途中で切れていないかを確かめてから使う */
export const readVoice = (store: VoiceStore, keys: string[]): Voice | null => {
  const found = findVoice(store, keys);
  if (!found) return null;
  const { key, dir } = found;
  const wav = path.join(dir, `${key}.wav`);
  let sec: number;
  try {
    sec = wavSeconds(readFileSync(wav));
  } catch (e) {
    throw new Error(
      `音声が壊れている: ${wav}（${e instanceof Error ? e.message : e}）。消してから、もう一度取り出すか作る（bun scripts/materials.ts pull）`,
    );
  }
  const meta = readMeta(dir, key);
  return {
    key,
    file: `${TTS_REL}/${key}.wav`,
    sec,
    kana: readFileSync(path.join(dir, `${key}.kana`), 'utf8'),
    ...(meta ? { meta } : {}),
  };
};

/**
 * 作った声を共有のキャッシュに書く。長さを測れない音声（壊れた WAV）は書かずに止める。
 * 音声 → 声の記録 → 読みの順に置き換える（読みがあれば、音声と記録も書き終えている。
 * 同じ台詞をほかの synth が同時に作っても、ほかの作業フォルダが読んでいても壊れない）
 */
export const writeVoice = (store: VoiceStore, key: string, wav: Buffer, kana: string, meta?: VoiceMeta): Voice => {
  const sec = wavSeconds(wav);
  writeAtomic(path.join(store.cache, `${key}.wav`), wav);
  if (meta) writeAtomic(path.join(store.cache, `${key}.meta.json`), metaJson(meta));
  writeAtomic(path.join(store.cache, `${key}.kana`), kana);
  return { key, file: `${TTS_REL}/${key}.wav`, sec, kana, ...(meta ? { meta } : {}) };
};

/* ───────────── 声の探し方 ───────────── */

/** 声の探し方（台詞の探す鍵の並び → 見つけた声。無ければ null） */
export type VoiceSource = (keys: string[]) => Voice | null;

/** 声のキャッシュ（共有のキャッシュ → .work/tts）の音声と読みで探す。ふつうの探し方 */
export const cacheSource =
  (store: VoiceStore): VoiceSource =>
  (keys) =>
    readVoice(store, keys);

/** 長さの一覧と読み（素材のブランチの DURATIONS.json・.kana・SHA256SUMS。scripts/materials.ts の pullDurations） */
export type DurationIndex = {
  durations: ReadonlyMap<string, { samples: number; rate: number; sha256: string }>;
  kana: ReadonlyMap<string, string>;
  sums: ReadonlyMap<string, string>;
};

/**
 * 長さの一覧と読みだけで探す（音声は読まない。synth.ts --durations-only）。長さを測った WAV（sha256）が、SHA256SUMS の WAV と
 * 同じ鍵だけを使う（違えば、その長さは古い）。長さは samples / rate（WAV から測る長さと同じ値）
 */
export const durationSource =
  (index: DurationIndex): VoiceSource =>
  (keys) => {
    for (const key of keys) {
      const d = index.durations.get(key);
      const kana = index.kana.get(key);
      if (d && kana !== undefined && index.sums.get(`${TTS_REL}/${key}.wav`) === d.sha256)
        return { key, file: `${TTS_REL}/${key}.wav`, sec: d.samples / d.rate, kana };
    }
    return null;
  };

/** 動画の声の、エンジンの版ごとの台詞の数（記録の無い v1 の声は数えない） */
export const versionsOf = (voices: Voice[][]): Map<string, number> => {
  const out = new Map<string, number>();
  for (const v of voices.flat()) if (v.meta) out.set(v.meta.engineVersion, (out.get(v.meta.engineVersion) ?? 0) + 1);
  return out;
};
