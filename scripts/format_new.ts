// 足したファイルだけを、Biome で整形する・整形を確かめる。
// 全体の整形は、開いている講座の PR が 0 の日に 1 回で行う（それまで biome.jsonc の formatter は切ってある）。
// それまでも、新しいファイルは整った形で入れて、全体の整形の差分を増やさない。
//   bun scripts/format_new.ts                  # 確かめる（整っていなければ止まる）。比べる相手は origin/main
//   bun scripts/format_new.ts --write          # 整形する（npm run format:new）
//   bun scripts/format_new.ts --base HEAD^1    # 比べる相手を変える（CI の pull_request は、マージの commit の 1 つ目の親）
//                                              # 別の PR の上に積んだ branch では、土台の branch を指す
// 足したファイル: 比べる相手との分かれ目に無く、今の木にあるファイル（名前を変えただけのものは入れない）と、まだ追跡していないファイル。
// 台本（content）・生成物・テストの記録・Biome が扱わない種類（Markdown・YAML・Python など）は、biome.jsonc の対象の外なので飛ばす。
// 終了コード: 0 整っている（--write は整えた）・1 整っていない・2 使い方の誤り・3 前提が足りない（比べる相手が無い）
import { existsSync } from 'node:fs';
import path from 'node:path';
import { EXIT, MissingError, readArgs, runMain, showHelp } from './lib/args';
import { ROOT } from './lib/paths';
import { run, runInherit, runOrThrow } from './lib/proc';

const BIOME = path.join(ROOT, 'node_modules/.bin/biome');

const git = (...a: string[]) => runOrThrow('git', a, { cwd: ROOT });
const list = (out: string) => out.split('\0').filter(Boolean);

const main = (argv: string[]) => {
  const { values } = readArgs(argv, { write: { type: 'boolean' }, base: { type: 'string', default: 'origin/main' } });
  if (values.help) return showHelp(import.meta.filename);
  const write = values.write === true;
  const base = values.base;

  const found = run('git', ['merge-base', base, 'HEAD'], { cwd: ROOT });
  if (found.code !== 0) throw new MissingError(`比べる相手 ${base} が見つかりません（git fetch origin main のあとで流すか、--base で指す）`);
  const from = found.stdout.trim();
  const files = [
    ...new Set([
      ...list(git('diff', '--name-only', '--diff-filter=A', '-z', from)),
      ...list(git('ls-files', '--others', '--exclude-standard', '-z')),
    ]),
  ].filter((f) => existsSync(path.join(ROOT, f)));
  if (!files.length) {
    console.log(`足したファイルはありません（${base} と比べた）`);
    return EXIT.ok;
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
  const code = runInherit(BIOME, [...command, ...files.map((f) => `./${f}`)], { cwd: ROOT });
  if (code !== 0 && !write) {
    console.error('足したファイルの整形が違います。npm run format:new で整えてから commit する');
  }
  return code;
};

if (import.meta.main) await runMain(main);
