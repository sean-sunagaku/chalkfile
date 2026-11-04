// 新しい作業フォルダ（git worktree）を作り、すぐに使える形にする。並行のセッションで、作業を作業フォルダごとに分けるときに使う。
//   npm run worktree:new -- <type>/<slug>        # 例: npm run worktree:new -- feat/new-course（隣の chalkfile-new-course に作る）
//   bun scripts/worktree.ts <type>/<slug> [--base <ref>] [--dir <フォルダ>]   # 分かれる元（既定 origin/main）・作る場所を変える
//   bun scripts/worktree.ts <type>/<slug> --dry-run                         # 何をするかを出すだけ（何も作らない）
//   すること（順に）: 1. git fetch origin（ほかの作業フォルダの fetch と参照のロックを取り合ったら、少し待って流し直す）
//     2. git worktree add -b <type>/<slug> <フォルダ> <base>
//     3. node_modules: この作業フォルダと package-lock.json が同じで、APFS なら cp -c -R で複製する（中身を写さないので速い）。
//        そうでなければ、その中で npm ci --ignore-scripts
//     4. 素材を取り出す（その中で bun scripts/materials.ts pull。台詞の声は、共有のキャッシュに同じ中身があれば取り出さない）と、
//        Worker の許可リスト（bun scripts/gen.ts --media）
//     5. 次にやることを出す
// 入力: <type>/<slug>（type は feat・fix・refactor・docs・chore・test・build・ci・perf、slug は英小文字・数字・-）・origin・この作業フォルダの node_modules
// 出力: 新しい作業フォルダと branch。終了コード: 0 できた・1 失敗・2 使い方の誤り（名前の形・もうある branch かフォルダ）・3 前提が足りない（base が無い・git・npm が無い）
// 前提: git と bun（素材の取り出しに ffmpeg。共有のキャッシュに声があれば、台詞の声は変換しない）
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { MissingError, readArgs, runMain, showHelp, UsageError } from './lib/args';
import { ROOT } from './lib/paths';
import { gitFetch, run, runInherit, runOrThrow } from './lib/proc';

const TYPES = ['feat', 'fix', 'refactor', 'docs', 'chore', 'test', 'build', 'ci', 'perf'];
const NAME = /^([a-z]+)\/([a-z0-9][a-z0-9-]*)$/;

/** 作る作業フォルダ（名前と場所を確かめたもの） */
export type Plan = { branch: string; slug: string; dir: string; base: string };

/** <type>/<slug> と、作る場所を確かめる（git には触らない） */
export const planOf = (
  name: string | undefined,
  opts: { base?: string | undefined; dir?: string | undefined } = {},
  root = ROOT,
): Plan => {
  const m = NAME.exec(name ?? '');
  if (!name || !m)
    throw new UsageError(
      `作業の名前は <type>/<slug>（例: feat/new-course。slug は英小文字・数字・-）: ${name ?? '（無い）'}`,
    );
  if (!TYPES.includes(m[1]!)) throw new UsageError(`<type> は ${TYPES.join('・')} のどれか: ${m[1]!}`);
  const dir = path.resolve(root, opts.dir ?? path.join('..', `chalkfile-${m[2]!}`));
  return { branch: name, slug: m[2]!, dir, base: opts.base ?? 'origin/main' };
};

const git = (...args: string[]) => runOrThrow('git', args, { cwd: ROOT }).trim();

/** node_modules を、この作業フォルダから複製できるか（package-lock.json が同じで、APFS の複製が使える macOS） */
const canClone = (plan: Plan): boolean => {
  if (process.platform !== 'darwin' || !existsSync(path.join(ROOT, 'node_modules'))) return false;
  const lock = run('git', ['show', `${plan.base}:package-lock.json`], { cwd: ROOT });
  return lock.code === 0 && lock.stdout === readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8');
};

/** 依存を用意する。複製できなければ（できなかったら）、npm ci --ignore-scripts */
const installModules = (plan: Plan): string => {
  const to = path.join(plan.dir, 'node_modules');
  if (canClone(plan)) {
    if (run('cp', ['-c', '-R', path.join(ROOT, 'node_modules'), to]).code === 0)
      return 'この作業フォルダの node_modules を複製した（cp -c）';
    rmSync(to, { recursive: true, force: true });
  }
  const code = runInherit('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: plan.dir });
  if (code !== 0) throw new Error(`npm ci --ignore-scripts が通らない（${plan.dir}。上の npm の出力）`);
  return 'npm ci --ignore-scripts で入れた';
};

const main = (argv: string[]) => {
  const { values, positionals } = readArgs(
    argv,
    { base: { type: 'string' }, dir: { type: 'string' }, 'dry-run': { type: 'boolean' } },
    { positionals: true },
  );
  if (values.help) return showHelp(import.meta.filename);
  if (positionals.length > 1) throw new UsageError(`作業の名前は 1 つだけ渡す: ${positionals.join(' ')}`);
  const plan = planOf(positionals[0], { base: values.base, dir: values.dir });
  const rel = path.relative(ROOT, plan.dir) || '.';
  if (existsSync(plan.dir)) throw new UsageError(`作る場所がもうある: ${rel}（--dir で別の場所を指す）`);
  if (run('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${plan.branch}`], { cwd: ROOT }).code === 0) {
    throw new UsageError(`branch ${plan.branch} はもうある（別の名前にするか、その branch の作業フォルダを使う）`);
  }
  const steps = [
    'git fetch origin',
    `git worktree add -b ${plan.branch} ${rel} ${plan.base}`,
    'node_modules を複製する（cp -c -R）か、npm ci --ignore-scripts',
    `(cd ${rel} && bun scripts/materials.ts pull && bun scripts/gen.ts --media)`,
  ];
  if (values['dry-run']) {
    console.log(
      ['作業フォルダを作る（--dry-run なので、何もしない）:', ...steps.map((s, i) => `  ${i + 1}. ${s}`)].join('\n'),
    );
    return;
  }

  const t0 = Date.now();
  const lap = (what: string) => console.log(`${what}（${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
  gitFetch(ROOT, ['--quiet', 'origin']);
  if (run('git', ['rev-parse', '--verify', '--quiet', `${plan.base}^{commit}`], { cwd: ROOT }).code !== 0) {
    throw new MissingError(`分かれる元が無い: ${plan.base}（git fetch のあとも見つからない）`);
  }
  lap(`1. git fetch origin（${plan.base} は ${git('rev-parse', '--short', `${plan.base}^{commit}`)}）`);
  git('worktree', 'add', '--quiet', '-b', plan.branch, plan.dir, plan.base);
  lap(`2. 作業フォルダ ${rel}（branch ${plan.branch}）`);
  lap(`3. ${installModules(plan)}`);
  for (const args of [
    ['scripts/materials.ts', 'pull'],
    ['scripts/gen.ts', '--media'],
  ]) {
    const code = runInherit(process.execPath, args, { cwd: plan.dir });
    if (code !== 0) throw new Error(`${rel} で bun ${args.join(' ')} が通らない（終了コード ${code}。上の出力）`);
  }
  lap('4. 素材と Worker の許可リスト');
  console.log(
    [
      '',
      `作業フォルダができた: ${rel}（branch ${plan.branch}。${plan.base} から）`,
      '次にやること:',
      `  cd ${rel}`,
      '  npm run synth -- --cached-only    # 時刻とサイトのデータ（素材の声を使う。VOICEVOX は要らない）',
      '  npm run check                     # PR を出す前に（AGENTS.md の「並行作業のきまり」も読む）',
      `片付けるとき: git worktree remove ${rel} && git branch -d ${plan.branch}`,
    ].join('\n'),
  );
};

if (import.meta.main) await runMain(main);
