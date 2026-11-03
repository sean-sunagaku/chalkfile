// 道具（scripts/）の決まり: import しただけでは何も起きない。-h／--help は頭書きを出すだけで、何も消さず・何も書かない。
// 知らない引数は「使い方の誤り」（終了コード 2）にする。子のプロセスで流し、作業フォルダ・共有のキャッシュ・一時フォルダが変わらないことを見る
import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, lstatSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { headerOf } from '../scripts/lib/args';

const ROOT = path.resolve(import.meta.dir, '..');
const sandbox = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-scripts-test-'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

/** CLI の道具（TS は bun、stills.ts は node、シェル、Python） */
const TS = [
  'build_materials',
  'check_content',
  'clean',
  'cli',
  'check_overlap',
  'doctor',
  'export_deliverables',
  'format_new',
  'gen',
  'gen_video_config',
  'materials',
  'media',
  'setup_cloudflare_ci',
  'snapshots',
  'stills-compare',
  'stills-compare-side',
  'synth',
  'validate',
  'worker_types',
  'worktree',
];
/** CLI でない部品（import されるだけ） */
const MODULES = [
  'media-lists',
  'timelines',
  'voices',
  ...readdirSync(path.join(ROOT, 'scripts/lib')).map((f) => `lib/${f.replace(/\.ts$/, '')}`),
];
const NODE = ['node', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON'];
type Case = { name: string; argv: string[]; file: string };
const CLI: Case[] = [
  ...TS.map((n) => ({ name: `${n}.ts`, argv: [process.execPath, `scripts/${n}.ts`], file: `scripts/${n}.ts` })),
  { name: 'stills.ts（node）', argv: [...NODE, 'scripts/stills.ts'], file: 'scripts/stills.ts' },
  { name: 'render.sh', argv: ['bash', 'scripts/render.sh'], file: 'scripts/render.sh' },
];
const python = Bun.which('python3');
const PY: Case[] = ['mix', 'tts_kokoro', 'check_speech'].map((n) => ({
  name: `${n}.py`,
  argv: [python ?? 'python3', `scripts/${n}.py`],
  file: `scripts/${n}.py`,
}));

/** 作業フォルダ（node_modules・.git・.venv を除く）のファイルとフォルダの、大きさと時刻 */
const SKIP = new Set(['node_modules', '.git', '.venv']);
const snapshot = (dir: string, out = new Map<string, string>(), rel = ''): Map<string, string> => {
  for (const name of readdirSync(dir)) {
    if (!rel && SKIP.has(name)) continue;
    const p = path.join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    const s = lstatSync(p);
    out.set(r, s.isDirectory() ? `dir ${s.mtimeMs}` : `${s.size} ${s.mtimeMs}`);
    if (s.isDirectory()) snapshot(p, out, r);
  }
  return out;
};
const changed = (a: Map<string, string>, b: Map<string, string>) =>
  [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k)).sort();

/** 子のプロセスで流す。共有のキャッシュと一時フォルダは、流すたびに空のフォルダにする（何か書けば分かる） */
const runChild = (argv: string[]) => {
  const cache = mkdtempSync(path.join(sandbox, 'cache-'));
  const tmp = mkdtempSync(path.join(sandbox, 'tmp-'));
  const before = snapshot(ROOT);
  const r = Bun.spawnSync(argv, {
    cwd: ROOT,
    env: { ...process.env, CHALKFILE_CACHE_DIR: cache, TMPDIR: tmp, CI: 'true' },
    stdin: 'ignore',
  });
  return {
    code: r.exitCode,
    stdout: r.stdout.toString(),
    stderr: r.stderr.toString(),
    changed: changed(before, snapshot(ROOT)),
    cache: readdirSync(cache),
    tmp: readdirSync(tmp),
  };
};

describe('--help は頭書きを出すだけで、何も消さず・何も書かない', () => {
  for (const c of CLI)
    test(c.name, () => {
      const r = runChild([...c.argv, '--help']);
      expect({ code: r.code, stderr: r.stderr, changed: r.changed, cache: r.cache, tmp: r.tmp }).toEqual({
        code: 0,
        stderr: '',
        changed: [],
        cache: [],
        tmp: [],
      });
      // 頭書きを出す（cli.ts は、そのあとにコマンドの一覧も出す）
      expect(r.stdout.startsWith(`${headerOf(path.join(ROOT, c.file)).trim()}\n`)).toBe(true);
      expect(r.stdout).toMatch(/scripts\/[\w-]+\.(ts|sh)/);
    }, 60_000);
  for (const c of PY)
    test.skipIf(!python)(
      `${c.name}（依存を入れる前でも出す）`,
      () => {
        const r = runChild([...c.argv, '--help']);
        expect({ code: r.code, changed: r.changed, cache: r.cache }).toEqual({ code: 0, changed: [], cache: [] });
        expect(r.stdout.trim()).toBe(headerOf(path.join(ROOT, c.file)).trim());
      },
      60_000,
    );
});

describe('import しただけでは何も起きない（出力も、ファイルの変化も無い）', () => {
  for (const name of [...TS, 'stills', ...MODULES])
    test(name, () => {
      const file = path.join(ROOT, 'scripts', `${name}.ts`);
      const r = runChild([process.execPath, '-e', `await import(${JSON.stringify(file)}); console.log('imported')`]);
      expect({ code: r.code, stdout: r.stdout, stderr: r.stderr, changed: r.changed, cache: r.cache }).toEqual({
        code: 0,
        stdout: 'imported\n',
        stderr: '',
        changed: [],
        cache: [],
      });
    }, 60_000);
});

describe('知らない引数は、何もせずに「使い方の誤り」（終了コード 2）で止める', () => {
  const unknown: [string, string[]][] = [
    ['synth.ts', [process.execPath, 'scripts/synth.ts', '--nope']],
    ['synth.ts（無い動画）', [process.execPath, 'scripts/synth.ts', 'ZZ99']],
    ['materials.ts', [process.execPath, 'scripts/materials.ts', 'pull', '--nope']],
    ['materials.ts（コマンドなし）', [process.execPath, 'scripts/materials.ts']],
    ['media.ts', [process.execPath, 'scripts/media.ts', 'push']],
    ['gen.ts', [process.execPath, 'scripts/gen.ts', '--nope']],
    ['validate.ts', [process.execPath, 'scripts/validate.ts', 'extra']],
    ['build_materials.ts', [process.execPath, 'scripts/build_materials.ts', '--nope']],
    ['export_deliverables.ts', [process.execPath, 'scripts/export_deliverables.ts']],
    ['check_overlap.ts', [process.execPath, 'scripts/check_overlap.ts']],
    ['stills.ts', [...NODE, 'scripts/stills.ts']],
    ['render.sh', ['bash', 'scripts/render.sh', '--nope']],
    ['worktree.ts', [process.execPath, 'scripts/worktree.ts', 'bad-name']],
    ['clean.ts', [process.execPath, 'scripts/clean.ts', '--nope']],
  ];
  for (const [name, argv] of unknown)
    test(name, () => {
      const r = runChild(argv);
      expect({ code: r.code, changed: r.changed, cache: r.cache }).toEqual({ code: 2, changed: [], cache: [] });
      // 何がおかしいかを 1 行以上で出す（使い方の誤りの文）
      expect(r.stderr.trim()).not.toBe('');
    }, 60_000);
});

test('頭書きの読み方（// の行・/** */ のかたまり・# の行・Python の docstring）', () => {
  const dir = mkdtempSync(path.join(sandbox, 'header-'));
  const put = (name: string, text: string) => {
    writeFileSync(path.join(dir, name), text);
    return path.join(dir, name);
  };
  expect(headerOf(put('a.ts', '// 説明\n//   bun a.ts\nimport x from "y";\n// 後ろのコメント\n'))).toBe(
    '説明\n  bun a.ts',
  );
  expect(headerOf(put('b.ts', '/**\n * 説明\n *   bun b.ts\n */\nconst x = 1;\n'))).toBe('説明\n  bun b.ts');
  expect(headerOf(put('c.sh', '#!/usr/bin/env bash\n# 説明\n#   bash c.sh\nset -e\n'))).toBe('説明\n  bash c.sh');
  expect(
    headerOf(put('d.py', '# /// script\n# dependencies = []\n# ///\n"""説明。\n\n  uv run d.py\n"""\nimport os\n')),
  ).toBe('説明。\n\n  uv run d.py');
  expect(existsSync(path.join(dir, 'a.ts'))).toBe(true);
});
