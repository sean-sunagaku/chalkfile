// リポジトリ（作業フォルダ）の置き場所と、作業フォルダの間で共有するキャッシュの置き場所。道具ごとに書いていた ROOT を、ここ 1 か所にする。
// Node で動かす道具（scripts/stills.ts）も読むので、node: のモジュールだけを使う
import os from 'node:os';
import path from 'node:path';

/** リポジトリ（作業フォルダ）の最上位 */
export const ROOT = path.resolve(import.meta.dirname, '../..');

/**
 * 作業フォルダの間で共有するキャッシュ。中身から名前が決まるもの（今は台詞の音声と読み）だけを置く。
 * 環境変数 CHALKFILE_CACHE_DIR、無ければ ~/.cache/chalkfile（Python の側は scripts/audio/common.py の cache_dir）
 */
export const cacheDir = (env: NodeJS.ProcessEnv = process.env): string =>
  env.CHALKFILE_CACHE_DIR ? path.resolve(env.CHALKFILE_CACHE_DIR) : path.join(os.homedir(), '.cache', 'chalkfile');

/**
 * 台詞の音声と読み（<鍵>.wav・<鍵>.kana）の名前の頭。鍵は文と合成のレシピから決まる（scripts/voices.ts の ttsKeysIn）ので、同じ名前なら中身も同じ。
 * 素材の SHA256SUMS・設計図（.work/plan）・聞き取りの対応（.work/speech）には、場所に縛られないこの名前を書く
 */
export const TTS_REL = '.work/tts';

/**
 * 台詞の音声と読みの置き場所。書くのは共有のキャッシュ（<キャッシュ>/tts）。読むときは、先に共有のキャッシュ、
 * 無ければ作業フォルダの .work/tts（前の置き場所。そこに作った音声も、そのまま使える）
 */
export const ttsDirs = (root = ROOT, env: NodeJS.ProcessEnv = process.env): { cache: string; local: string } => ({
  cache: path.join(cacheDir(env), 'tts'),
  local: path.join(root, TTS_REL),
});
