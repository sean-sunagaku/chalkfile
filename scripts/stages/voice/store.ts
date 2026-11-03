// 台詞の音声と読み（<鍵>.wav・<鍵>.kana）の置き場所（声のキャッシュ）。
// 書くのは作業フォルダの間で共有のキャッシュ（<キャッシュ>/tts。scripts/lib/paths.ts の ttsDirs）。読むときは、先に共有のキャッシュ、
// 無ければ作業フォルダの .work/tts（前の置き場所）も探す。音声と読みが同じフォルダにそろっているものだけを使う
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { writeAtomic } from '../../lib/fsx';
import { TTS_REL } from '../../lib/paths';
import { wavSeconds } from '../../lib/wav';
import type { LineVoice } from '../timeline/compute';

/** 声の置き場所。書くのは cache、読むときは cache → local の順 */
export type VoiceStore = { cache: string; local: string };

/** 見つけた声（key はファイルの名前の鍵） */
export type Voice = LineVoice & { key: string };

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
  return { key, file: `${TTS_REL}/${key}.wav`, sec, kana: readFileSync(path.join(dir, `${key}.kana`), 'utf8') };
};

/**
 * 作った声を共有のキャッシュに書く。長さを測れない音声（壊れた WAV）は書かずに止める。
 * 音声を先に、読みを後に置き換える（読みがあれば、音声も書き終えている。
 * 同じ台詞をほかの synth が同時に作っても、ほかの作業フォルダが読んでいても壊れない）
 */
export const writeVoice = (store: VoiceStore, key: string, wav: Buffer, kana: string): Voice => {
  const sec = wavSeconds(wav);
  writeAtomic(path.join(store.cache, `${key}.wav`), wav);
  writeAtomic(path.join(store.cache, `${key}.kana`), kana);
  return { key, file: `${TTS_REL}/${key}.wav`, sec, kana };
};
