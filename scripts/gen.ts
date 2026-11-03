// 講座のフォルダの生成物から、全体の生成物を作る（npm run gen）。生成物がぶつかったら、main を取り込んでからこれで作り直す。
//   bun scripts/gen.ts            # 作る
//   bun scripts/gen.ts --check    # 作らずに、今のファイルと比べる（違えば一覧を出して 1 で終える）
//   bun scripts/gen.ts --media    # Worker の許可リストだけを作る（wrangler の前。dev:worker・CI の build・deploy.yml が流す）
// 作るもの:
//   worker/src/generated/media-manifest.json   全講座の動画の一覧（Worker の許可リスト。Git に入れない）。講座ごとの
//                                              content/<講座>/generated/media.<言語>.json を、講座の登録の順につなぐ（scripts/media.ts）
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readMediaManifest } from './media';
import { mediaManifestJson } from './media-lists';

const ROOT = path.resolve(import.meta.dir, '..');

/** Worker の許可リスト（wrangler が worker/src/index.ts と一緒にまとめる。Git に入れない） */
export const WORKER_MEDIA = 'worker/src/generated/media-manifest.json';

/** 作る生成物（リポジトリの直下からのパス → 中身）。media だけにすると、Worker の許可リストだけ */
export const generated = (only?: 'media'): Map<string, string> => {
  const out = new Map<string, string>();
  out.set(WORKER_MEDIA, mediaManifestJson(readMediaManifest()));
  if (only === 'media') return out;
  return out;
};

/** 今のファイルと違う生成物（無いものも違うとする） */
export const staleOutputs = (outputs: Map<string, string>, root = ROOT): string[] =>
  [...outputs]
    .filter(
      ([file, text]) => !existsSync(path.join(root, file)) || readFileSync(path.join(root, file), 'utf8') !== text,
    )
    .map(([file]) => file);

if (import.meta.main) {
  const args = process.argv.slice(2);
  for (const a of args)
    if (!['--check', '--media'].includes(a)) throw new Error(`知らない引数: ${a}（使えるのは --check と --media）`);
  const outputs = generated(args.includes('--media') ? 'media' : undefined);
  const stale = staleOutputs(outputs);
  if (args.includes('--check')) {
    for (const f of stale) console.log(`違う: ${f}（npm run gen で作り直す）`);
    console.log(
      stale.length
        ? `生成物が ${stale.length} 個、作り直したものと違う`
        : `生成物は作り直したものと同じ（${outputs.size} 個）`,
    );
    process.exit(stale.length ? 1 : 0);
  }
  for (const [file, text] of outputs) {
    if (!stale.includes(file)) continue;
    const to = path.join(ROOT, file);
    mkdirSync(path.dirname(to), { recursive: true });
    const pending = path.join(path.dirname(to), `.${path.basename(to)}.${process.pid}.tmp`);
    writeFileSync(pending, text);
    renameSync(pending, to);
  }
  console.log(
    `生成物 ${outputs.size} 個（作り直した ${stale.length} 個${stale.length ? `: ${stale.join(' ')}` : ''}）`,
  );
}
