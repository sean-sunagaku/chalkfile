// 足したファイルだけを、Biome で整形する・整形を確かめる。
// 全体の整形は、開いている講座の PR が 0 の日に 1 回で行う（それまで biome.jsonc の formatter は切ってある）。
// それまでも、新しいファイルは整った形で入れて、全体の整形の差分を増やさない。
//   bun scripts/format_new.ts                  # 確かめる（整っていなければ止まる）。比べる相手は origin/main
//   bun scripts/format_new.ts --write          # 整形する（npm run format:new）
//   bun scripts/format_new.ts --base HEAD^1    # 比べる相手を変える（CI の pull_request は、マージの commit の 1 つ目の親）
//                                              # 別の PR の上に積んだ branch では、土台の branch を指す
// 足したファイル: 比べる相手との分かれ目に無く、今の木にあるファイル（名前を変えただけのものは入れない）と、まだ追跡していないファイル。
// 台本（content）・生成物・テストの記録・Biome が扱わない種類（Markdown・YAML・Python など）は、biome.jsonc の対象の外なので飛ばす。
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '..');
const BIOME = path.join(ROOT, 'node_modules/.bin/biome');

const args = process.argv.slice(2);
const write = args.includes('--write');
const baseAt = args.indexOf('--base');
const base = baseAt >= 0 ? args[baseAt + 1] : 'origin/main';
const unknown = args.filter((a, i) => a !== '--write' && a !== '--base' && (baseAt < 0 || i !== baseAt + 1));
if (!base || unknown.length) {
  console.error('使い方: bun scripts/format_new.ts [--write] [--base <ref>]');
  process.exit(2);
}

const git = (...a: string[]) =>
  execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const list = (out: string) => out.split('\0').filter(Boolean);

let from: string;
try {
  from = git('merge-base', base, 'HEAD').trim();
} catch {
  console.error(`比べる相手 ${base} が見つかりません（git fetch origin main のあとで流すか、--base で指す）`);
  process.exit(2);
}
const files = [
  ...new Set([
    ...list(git('diff', '--name-only', '--diff-filter=A', '-z', from)),
    ...list(git('ls-files', '--others', '--exclude-standard', '-z')),
  ]),
].filter((f) => existsSync(path.join(ROOT, f)));
if (!files.length) {
  console.log(`足したファイルはありません（${base} と比べた）`);
  process.exit(0);
}

const common = [
  '--formatter-enabled=true',
  '--linter-enabled=false',
  '--assist-enabled=false',
  '--no-errors-on-unmatched',
  '--files-ignore-unknown=true',
];
const command = write ? ['check', '--write', ...common] : ['ci', ...common];
// ./ を付けて、- で始まる名前のファイルをフラグと取り違えないようにする
const result = spawnSync(BIOME, [...command, ...files.map((f) => `./${f}`)], { cwd: ROOT, stdio: 'inherit' });
if (result.status !== 0 && !write) {
  console.error('足したファイルの整形が違います。npm run format:new で整えてから commit する');
}
process.exit(result.status ?? 1);
