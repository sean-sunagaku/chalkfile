// 台本と素材から作り直せる生成物を消して、作業フォルダの空きを作る（台本・Git に入れるもの・素材のブランチには触らない）。
//   npm run clean                 # out/・public/audio/mix/・site/dist/・.work/state/ を消す（共有のキャッシュは残す）
//   npm run clean -- --cache      # 共有のキャッシュの台詞の声（CHALKFILE_CACHE_DIR の tts/。既定 ~/.cache/chalkfile/tts/）も消す。
//                                 # ほかの作業フォルダも使っているので、消したら npm run materials:pull で取り出し直す
//   npm run clean -- --dry-run    # 消すものと大きさを出すだけ（何も消さない）
//   bun scripts/clean.ts [--cache] [--dry-run]   # npm run clean と同じ
// 入力: 環境変数 CHALKFILE_CACHE_DIR（--cache のとき）
// 出力: 消したものと大きさ。終了コード: 0 できた・1 失敗・2 使い方の誤り
// 前提: なし
import { existsSync, lstatSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readArgs, runMain, showHelp } from './lib/args';
import { ROOT, ttsDirs } from './lib/paths';

/** 作業フォルダの中で消すもの（リポジトリの直下から） */
export const CLEAN = ['out', 'public/audio/mix', 'site/dist', '.work/state'];

/** フォルダの中のファイルの大きさの合計（symlink はたどらない） */
const sizeOf = (p: string): number => {
  const s = lstatSync(p);
  if (!s.isDirectory()) return s.size;
  return readdirSync(p).reduce((n, name) => n + sizeOf(path.join(p, name)), 0);
};
const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)}MB`;

/** 消すもの（有るものだけ）。cache なら共有のキャッシュの台詞の声も。キャッシュの場所が、家のフォルダや作業フォルダそのものなら止める */
export const targetsOf = (cache: boolean, root = ROOT, env: NodeJS.ProcessEnv = process.env): string[] => {
  const list = CLEAN.map((rel) => path.join(root, rel));
  if (cache) {
    const tts = ttsDirs(root, env).cache;
    const top = path.dirname(tts);
    if ([path.parse(top).root, os.homedir(), root].includes(top))
      throw new Error(`共有のキャッシュの場所がおかしいので消さない: ${top}（CHALKFILE_CACHE_DIR を見直す）`);
    list.push(tts);
  }
  return list.filter((p) => existsSync(p));
};

const main = (argv: string[]) => {
  const { values } = readArgs(argv, { cache: { type: 'boolean' }, 'dry-run': { type: 'boolean' } });
  if (values.help) return showHelp(import.meta.filename);
  const dry = values['dry-run'] === true;
  const targets = targetsOf(values.cache === true);
  let total = 0;
  for (const p of targets) {
    const size = sizeOf(p);
    total += size;
    const shown = p.startsWith(`${ROOT}${path.sep}`) ? path.relative(ROOT, p) : p;
    console.log(`${dry ? '消すもの' : '消した'}: ${shown}（${mb(size)}）`);
    if (!dry) rmSync(p, { recursive: true, force: true });
  }
  console.log(
    targets.length
      ? `${dry ? '消すと' : '消して'} ${mb(total)} 空く${dry ? '（--dry-run なので、何も消していない）' : ''}${values.cache ? '。共有のキャッシュは npm run materials:pull で取り出し直す' : ''}`
      : '消すものは無い',
  );
};

if (import.meta.main) await runMain(main);
