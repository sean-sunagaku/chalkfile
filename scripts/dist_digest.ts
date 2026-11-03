// 公開物（site/dist の全部のファイルと、Worker の許可リスト）の sha256 の一覧を作る・照らし合わせる。
// CI の build が一覧を作って artifact に入れ、一覧そのものの sha256 をジョブの出力で渡す。smoke と deploy は、artifact を取り、
// Worker の許可リストを作り直したあとで、一覧の sha256 と、今のファイルが一覧どおりかを照らす（足りない・多い・違うファイルがあれば止まる）。
//   bun scripts/dist_digest.ts write [一覧のファイル]                 # 一覧を書き、一覧の sha256 を出す
//   bun scripts/dist_digest.ts verify <一覧の sha256> [一覧のファイル]  # 照らし合わせる
// 一覧の既定は .work/ci/site-dist.sha256。形は sha256sum と同じ（「sha256  パス」。パスはリポジトリの最上位から）なので、sha256sum -c でも確かめられる
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '..');
/** 組み立てた静的公開物と、Worker の許可リスト（npm run gen が作る。wrangler が Worker と一緒にまとめる） */
export const DIST = 'site/dist';
export const WORKER_MEDIA = 'worker/src/generated/media-manifest.json';
/** 一覧の置き場所（CI の artifact に入れる） */
export const LIST = '.work/ci/site-dist.sha256';

const sha256 = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
/** パスの並び（ロケールに左右されないよう、文字コードの順にする） */
const byPath = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** 一覧に入れるファイル（リポジトリの最上位からのパス。. で始まるファイルも入れる。シンボリックリンクがあれば止める） */
export function digestFiles(root = ROOT): string[] {
  if (!existsSync(path.join(root, DIST)))
    throw new Error(`${DIST} が無い（先に bun scripts/build_site.ts --strict で組み立てる）`);
  if (!existsSync(path.join(root, WORKER_MEDIA)))
    throw new Error(`${WORKER_MEDIA} が無い（先に bun scripts/gen.ts --media で作る）`);
  const files: string[] = [WORKER_MEDIA];
  const walk = (rel: string) => {
    for (const entry of readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`公開物にシンボリックリンクがある: ${child}`);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) files.push(child);
      else throw new Error(`公開物に、ふつうのファイルでないものがある: ${child}`);
    }
  };
  walk(DIST);
  return files.sort(byPath);
}

/** 一覧の中身（sha256sum と同じ形。1 行 1 ファイル） */
export const digestText = (root = ROOT) =>
  digestFiles(root)
    .map((rel) => `${sha256(readFileSync(path.join(root, rel)))}  ${rel}\n`)
    .join('');

/** 一覧を書き、一覧そのものの sha256 を返す */
export function writeDigest(root = ROOT, list = LIST): string {
  const text = digestText(root);
  mkdirSync(path.dirname(path.join(root, list)), { recursive: true });
  writeFileSync(path.join(root, list), text);
  return sha256(text);
}

const entriesOf = (text: string) =>
  new Map(
    text
      .split('\n')
      .filter(Boolean)
      .map((line) => [line.slice(66), line.slice(0, 64)] as const),
  );

/**
 * 一覧の sha256 が expected と同じで、今のファイルが一覧どおりかを確かめ、ファイルの数を返す。
 * 違えば、足りない・多い・中身が違うパスを並べて止める（中身は出さない）
 */
export function verifyDigest(expected: string, root = ROOT, list = LIST): number {
  if (!/^[0-9a-f]{64}$/.test(expected)) throw new Error('照らし合わせる一覧の sha256（64 桁の 16 進）が渡されていない');
  const file = path.join(root, list);
  if (!existsSync(file)) throw new Error(`一覧 ${list} が無い（build の artifact を取ったかを確かめる）`);
  const listed = readFileSync(file, 'utf8');
  if (sha256(listed) !== expected) throw new Error(`一覧 ${list} の sha256 が、build が出したものと違う`);
  const now = digestText(root);
  const was = entriesOf(listed);
  if (now === listed) return was.size;
  const is = entriesOf(now);
  const missing = [...was.keys()].filter((p) => !is.has(p));
  const extra = [...is.keys()].filter((p) => !was.has(p));
  const changed = [...was.keys()].filter((p) => is.has(p) && is.get(p) !== was.get(p));
  const show = (what: string, paths: string[]) =>
    paths.length
      ? [`${what} ${paths.length} 個: ${paths.slice(0, 10).join('、')}${paths.length > 10 ? ' ほか' : ''}`]
      : [];
  const lines = [...show('足りない', missing), ...show('多い', extra), ...show('中身が違う', changed)];
  throw new Error(`公開物が、build の一覧と違う（${lines.join(' / ') || '並びが違う'}）`);
}

const USAGE = `使い方:
  bun scripts/dist_digest.ts write [一覧のファイル]                 一覧を書き、一覧の sha256 を出す（既定は ${LIST}）
  bun scripts/dist_digest.ts verify <一覧の sha256> [一覧のファイル]  公開物が一覧どおりかを照らす`;

if (import.meta.main) {
  const [command, ...rest] = process.argv.slice(2);
  try {
    if (command === 'write' && rest.length <= 1) {
      const list = rest[0] ?? LIST;
      const digest = writeDigest(ROOT, list);
      console.error(`一覧 ${list}（${digestFiles(ROOT).length} 個）を書いた`);
      console.log(digest);
    } else if (command === 'verify' && rest.length >= 1 && rest.length <= 2) {
      const count = verifyDigest(rest[0], ROOT, rest[1] ?? LIST);
      console.log(`公開物 ${count} 個が、build の一覧（sha256 ${rest[0].slice(0, 12)}…）と同じ`);
    } else {
      console.error(USAGE);
      process.exit(2);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
