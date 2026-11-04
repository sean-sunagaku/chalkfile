// 指紋を作る部品。段（scripts/stages/pipeline/stages.ts）が、入力から指紋を作るのに使う。
//   digest       値（キーを名前の順に並べた JSON）の sha256 の頭 16 字。項目を書く順では変わらない
//   FileHasher   ファイルの中身の sha256。大きさと時刻が前と同じなら、覚えた値を使う（.work/state/files.json。動画・音も毎回は読まない）
//   listFiles    フォルダの中のファイル（git が追跡するものと、まだ追跡していないもの。.gitignore で外したものは入れない）
//   codeFiles    道具の入口から、相対の import をたどったファイル（台本のデータ content/<講座>/ には入らない）
//   lockVersions package-lock.json に書いた、依存の版
// どれも、ファイルを読むだけで書かない（FileHasher の save だけが、覚えた値を書く）
import { createHash } from 'node:crypto';
import { type BigIntStats, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { writeAtomic } from '../../lib/fsx';
import { sha256File } from '../../lib/hash';
import { run } from '../../lib/proc';

/** キーを名前の順に並べた JSON（値の無い項目は入れない。配列の中の値の無いものは null）。JSON.stringify と同じ値の書き方 */
export const canonical = (x: unknown): string => {
  if (Array.isArray(x)) return `[${x.map((v) => (v === undefined ? 'null' : canonical(v))).join(',')}]`;
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    const keys = Object.keys(o)
      .filter((k) => o[k] !== undefined && typeof o[k] !== 'function')
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(x) ?? 'null';
};

/** 文字列の sha256（16 進） */
export const sha256Text = (text: string | Uint8Array): string => createHash('sha256').update(text).digest('hex');

/** 値の指紋（キーを並べた JSON の sha256 の頭 16 字） */
export const digest = (x: unknown): string => sha256Text(canonical(x)).slice(0, 16);

/* ───────────── ファイルの中身 ───────────── */

/** 覚えた値の置き場所（作業フォルダの中。npm run clean が .work/state と一緒に消す） */
export const HASHES_FILE = '.work/state/files.json';

/** 覚えた値。大きさ・時刻（中身と inode の変わった時刻。ナノ秒）・inode が同じなら、中身も同じとみなす */
type Seen = { stat: string; sha256: string };
/** 比べる値（大きさ・時刻・inode をつないだもの） */
const statKey = (s: { size: bigint; mtimeNs: bigint; ctimeNs: bigint; ino: bigint }) =>
  `${s.size}:${s.mtimeNs}:${s.ctimeNs}:${s.ino}`;

/** ファイルの中身の sha256。無いファイルは null。大きさ・時刻・inode が覚えた値と同じなら、読み直さない */
export type FileHasher = {
  sha256: (file: string) => string | null;
  /** 覚えた値を書く（読み直したものがあるときだけ） */
  save: () => void;
};

/** root はリポジトリの直下。cache を空にすると、覚えた値を読まず・書かない（テスト） */
export const fileHasher = (root: string, cache: string | null = path.join(root, HASHES_FILE)): FileHasher => {
  let seen: Record<string, Seen> = {};
  if (cache && existsSync(cache)) {
    try {
      seen = JSON.parse(readFileSync(cache, 'utf8')) as Record<string, Seen>;
    } catch {
      seen = {};
    }
  }
  let dirty = false;
  return {
    sha256: (file) => {
      const abs = path.resolve(root, file);
      let s: BigIntStats | undefined;
      try {
        s = statSync(abs, { bigint: true });
      } catch {
        return null;
      }
      if (!s?.isFile()) return null;
      const key = path.relative(root, abs).startsWith('..') ? abs : path.relative(root, abs);
      const stat = statKey(s);
      const old = seen[key];
      if (old && old.stat === stat) return old.sha256;
      const sha256 = sha256File(abs);
      seen[key] = { stat, sha256 };
      dirty = true;
      return sha256;
    },
    save: () => {
      if (!cache || !dirty) return;
      writeAtomic(cache, `${JSON.stringify(seen)}\n`);
      dirty = false;
    },
  };
};

/* ───────────── ファイルの一覧 ───────────── */

/** フォルダをたどる（git の無い所。. で始まる名前と node_modules は入れない） */
const walk = (root: string, rel: string): string[] => {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return [];
  if (!statSync(abs).isDirectory()) return [rel];
  return readdirSync(abs)
    .filter((n) => !n.startsWith('.') && n !== 'node_modules')
    .flatMap((n) => walk(root, rel ? `${rel}/${n}` : n));
};

/**
 * specs（フォルダかファイル。リポジトリの直下から）の中のファイル（名前の順）。git が追跡するものと、まだ追跡していないもの
 * （.gitignore で外したもの・消したものは入れない）。git の無い所（テストの一時のフォルダ）では、フォルダをたどる
 */
export const listFiles = (root: string, specs: readonly string[]): string[] => {
  const r = existsSync(path.join(root, '.git'))
    ? run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...specs], { cwd: root })
    : null;
  const files =
    r && r.code === 0 ? r.stdout.split('\0').filter(Boolean) : specs.flatMap((s) => walk(root, s.replace(/\/$/, '')));
  return [...new Set(files)]
    .filter((f) => existsSync(path.join(root, f)) && statSync(path.join(root, f)).isFile())
    .sort();
};

/** ファイルの名前と中身の指紋（無いファイルは null として入る） */
export const filesDigest = (files: readonly string[], hasher: FileHasher): string =>
  digest([...files].sort().map((f) => [f, hasher.sha256(f)]));

/* ───────────── 道具のコード（import をたどる） ───────────── */

const IMPORT_RX =
  /(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;
const EXTS = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx'];

/** 台本のデータ（講座のフォルダ content/<講座>/）。中身は段のほかの入力（台本の指紋）が受け持つので、コードとして読まない */
const isCourseData = (rel: string) => /^content\/[^/]+\//.test(rel);

/**
 * 道具の入口（リポジトリの直下からのパス）から、相対の import（import・export from・import()）をたどったファイル（名前の順）。
 * JSON などのコードでないファイルも、import していれば入れる（中はたどらない）。講座のフォルダ（content/<講座>/）と node_modules には入らない
 */
export const codeFiles = (root: string, entries: readonly string[]): string[] => {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length) {
    // biome-ignore lint/style/noNonNullAssertion: queue.length を見てから取り出す
    const rel = queue.pop()!;
    if (seen.has(rel) || isCourseData(rel)) continue;
    const abs = path.join(root, rel);
    if (!existsSync(abs) || !statSync(abs).isFile()) continue;
    seen.add(rel);
    if (!/\.(?:ts|tsx|js|mjs)$/.test(rel)) continue;
    const text = readFileSync(abs, 'utf8');
    for (const m of text.matchAll(IMPORT_RX)) {
      const spec = (m[1] ?? m[2])!; // どちらかの import の捕捉群が必ずある
      const base = path.normalize(path.join(path.dirname(rel), spec));
      if (base.startsWith('..') || base.split(path.sep).includes('node_modules')) continue;
      const hit = EXTS.map((e) => `${base}${e}`).find(
        (p) => existsSync(path.join(root, p)) && statSync(path.join(root, p)).isFile(),
      );
      if (hit) queue.push(hit.split(path.sep).join('/'));
    }
  }
  return [...seen].sort();
};

/* ───────────── 依存と道具の版 ───────────── */

/** package-lock.json に書いた依存の版（names の順。無いものは空） */
export const lockVersions = (root: string, names: readonly string[]): Record<string, string> => {
  const file = path.join(root, 'package-lock.json');
  const lock = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as { packages?: Record<string, { version?: string }> })
    : {};
  return Object.fromEntries(names.map((n) => [n, lock.packages?.[`node_modules/${n}`]?.version ?? '']));
};

/** 道具の版（出力の最初の行。無ければ空）。記録に書くだけで、指紋には入れない */
export const commandVersion = (cmd: string, args: string[] = ['-version']): string => {
  try {
    const r = run(cmd, args, { timeoutMs: 10_000 });
    return r.code === 0 ? (r.stdout.split('\n')[0] ?? '').trim() : '';
  } catch {
    return '';
  }
};
