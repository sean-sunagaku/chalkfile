// 道具（scripts/）の決まり: import しただけでは何も起きない。-h／--help は頭書きを出すだけで、何も消さず・何も書かない。
// 知らない引数は「使い方の誤り」（終了コード 2）にする。子のプロセスで流し、作業フォルダ・共有のキャッシュ・一時フォルダが変わらないことを見る
import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, lstatSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VIDEOS } from '../../content';
import { timelineFile } from '../../engine/core/generated';
import { headerOf } from '../../scripts/lib/args';

const ROOT = path.resolve(import.meta.dir, '../..');
const sandbox = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-scripts-test-'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

/** CLI の道具（TS は bun、stills.ts は node、シェル、Python） */
const TS = [
  'serve',
  'i18n',
  'build_site',
  'check_delivery',
  'verify_public',
  'check_docs',
  'build_materials',
  'check_content',
  'codemod_content',
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
  'pipeline',
  'scaffold',
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
  'gen_project_config',
  'gen_materials_registry',
  ...readdirSync(path.join(ROOT, 'scripts/lib')).map((f) => `lib/${f.replace(/\.ts$/, '')}`),
  // 段の部品（scripts/stages/<段>/<部品>.ts）
  ...readdirSync(path.join(ROOT, 'scripts/stages')).flatMap((stage) =>
    readdirSync(path.join(ROOT, 'scripts/stages', stage)).map((f) => `stages/${stage}/${f.replace(/\.ts$/, '')}`),
  ),
];
const NODE = ['node', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON'];
type Case = { name: string; argv: string[]; file: string };
const CLI: Case[] = [
  ...['worker-site-smoke', 'smoke_worker'].map((name) => ({
    name: `${name}.ts`,
    argv: [process.execPath, `tools/verify/${name}.ts`],
    file: `tools/verify/${name}.ts`,
  })),
  ...TS.map((n) => ({ name: `${n}.ts`, argv: [process.execPath, `scripts/${n}.ts`], file: `scripts/${n}.ts` })),
  { name: 'stills.ts（node）', argv: [...NODE, 'scripts/stills.ts'], file: 'scripts/stills.ts' },
  {
    name: 'stages/video/render.ts',
    argv: [process.execPath, 'scripts/stages/video/render.ts'],
    file: 'scripts/stages/video/render.ts',
  },
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
      // 入口は package.json の scripts。前からある直接の流し方も読める。
      expect(r.stdout).toMatch(/scripts\/[\w/-]+\.(ts|sh)|npm run [\w:-]+/);
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
  for (const entry of [...CLI, ...MODULES.map((name) => ({ name, file: `scripts/${name}.ts` }))])
    test(entry.name, () => {
      const file = path.join(ROOT, entry.file);
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
  test('i18n stamp は、対象に訳が無いものが混じったら、書く前に「前提が足りない」（3）で止める', () => {
    const result = runChild([process.execPath, 'scripts/i18n.ts', 'stamp', 'P01.en', 'Z99.en']);
    expect({ code: result.code, changed: result.changed, cache: result.cache, tmp: result.tmp }).toEqual({
      code: 3,
      changed: [],
      cache: [],
      tmp: [],
    });
    expect(result.stderr).toContain('Z99.en');
  }, 60_000);
  const unknown: [string, string[]][] = [
    ...['serve', 'i18n', 'build_site', 'check_delivery', 'verify_public', 'check_docs'].map(
      (name): [string, string[]] => [name, [process.execPath, `scripts/${name}.ts`, '--nope']],
    ),
    ...['worker-site-smoke', 'smoke_worker'].map((name): [string, string[]] => [
      name,
      [process.execPath, `tools/verify/${name}.ts`, '--nope'],
    ]),
    ['build_site（無い講座）', [process.execPath, 'scripts/build_site.ts', 'no-such-course']],
    ['check_delivery（多い引数）', [process.execPath, 'scripts/check_delivery.ts', 'a', 'b']],
    ['verify_public（URLでない）', [process.execPath, 'scripts/verify_public.ts', 'bad-url']],
    ['verify_public（多い引数）', [process.execPath, 'scripts/verify_public.ts', 'https://example.com/', 'extra']],
    ['verify_public（ルートでない）', [process.execPath, 'scripts/verify_public.ts', 'https://example.com/sub/']],
    ['i18n（コマンドなし）', [process.execPath, 'scripts/i18n.ts']],
    ['i18n（statusの多い引数）', [process.execPath, 'scripts/i18n.ts', 'status', 'extra']],
    ['i18n（restampの多い引数）', [process.execPath, 'scripts/i18n.ts', 'restamp', 'extra']],
    ['i18n（stampの指定なし）', [process.execPath, 'scripts/i18n.ts', 'stamp']],
    ['i18n（stampの不正な指定）', [process.execPath, 'scripts/i18n.ts', 'stamp', '../P01.en']],
    ['i18n（stdoutの場所）', [process.execPath, 'scripts/i18n.ts', 'restamp', '--stdout']],
    ['i18n（scaffoldの指定なし）', [process.execPath, 'scripts/i18n.ts', 'scaffold']],
    ['i18n（scaffoldの多い指定）', [process.execPath, 'scripts/i18n.ts', 'scaffold', 'P01.en', 'W01.en']],
    ['i18n（tryの多い指定）', [process.execPath, 'scripts/i18n.ts', 'try', 'pstack-comedy', 'en', 'P01', 'extra']],
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
    ['stills.ts（形の違う動画の名前）', [...NODE, 'scripts/stills.ts', 'L01@abc']],
    ['stills.ts（無い場面）', [...NODE, 'scripts/stills.ts', 'L01:99']],
    ['stills.ts（形の違うテーマ）', [...NODE, 'scripts/stills.ts', 'L01', '--theme=../x']],
    ['render.ts', [process.execPath, 'scripts/stages/video/render.ts', '--nope']],
    ['render.ts（無い動画）', [process.execPath, 'scripts/stages/video/render.ts', 'ZZ99']],
    ['render.ts（形の違う動画の名前）', [process.execPath, 'scripts/stages/video/render.ts', '../L01']],
    ['render.ts（並列の数が 0）', [process.execPath, 'scripts/stages/video/render.ts', 'L12', '--jobs', '0']],
    [
      'render.ts（知らない CAPTIONS）',
      ['env', 'CAPTIONS=yes', process.execPath, 'scripts/stages/video/render.ts', 'L12'],
    ],
    ['pipeline.ts（コマンドなし）', [process.execPath, 'scripts/pipeline.ts']],
    ['pipeline.ts（知らない引数）', [process.execPath, 'scripts/pipeline.ts', 'status', '--nope']],
    ['pipeline.ts（--to が無い）', [process.execPath, 'scripts/pipeline.ts', 'build']],
    ['pipeline.ts（無い段）', [process.execPath, 'scripts/pipeline.ts', 'build', '--to', 'nope', '--dry-run']],
    ['pipeline.ts（無い単位の記録）', [process.execPath, 'scripts/pipeline.ts', 'record', 'mix', 'ZZ99']],
    [
      'pipeline.ts（書き出しは道具が自分で記録する）',
      [process.execPath, 'scripts/pipeline.ts', 'record', 'render', 'G01'],
    ],
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
  // timeline はあるが、ミックスの音が手元に無い動画（CI はどの動画も。無ければ確かめない）
  const lacking = VIDEOS.find(
    (v) =>
      existsSync(path.join(ROOT, timelineFile(v.course.id, v.key))) &&
      !existsSync(path.join(ROOT, `public/audio/mix/${v.key}.wav`)),
  );
  test.skipIf(!lacking)(
    'render.ts は、ミックスの音の無い動画を、バンドルを作る前に「前提が足りない」（3）で止め、何も書かない',
    () => {
      const r = runChild([process.execPath, 'scripts/stages/video/render.ts', lacking?.key ?? '']);
      expect({ code: r.code, changed: r.changed, cache: r.cache, tmp: r.tmp }).toEqual({
        code: 3,
        changed: [],
        cache: [],
        tmp: [],
      });
      expect(r.stderr).toContain(`${lacking?.key}: ミックスの音が無い（先に npm run mix -- ${lacking?.key}）`);
    },
    60_000,
  );
  test('stills.ts は、timeline の無い動画を、バンドルを作る前に「前提が足りない」（3）で止める', () => {
    const r = runChild([...NODE, 'scripts/stills.ts', 'ZZ99']);
    expect({ code: r.code, changed: r.changed, cache: r.cache, tmp: r.tmp }).toEqual({
      code: 3,
      changed: [],
      cache: [],
      tmp: [],
    });
    expect(r.stderr).toContain('ZZ99 の timeline が無い');
  }, 60_000);
  // Python の道具は、依存（numpy など）を読む前に引数を確かめる（依存の無い python3 でも 2 で止まる）
  const pyUnknown: [string, string[]][] = [
    ['mix.py', ['scripts/mix.py', '--nope']],
    ['mix.py（動画を渡していない）', ['scripts/mix.py']],
    ['mix.py（形の違う動画の名前）', ['scripts/mix.py', '../L01']],
    ['check_speech.py', ['scripts/check_speech.py', 'P01.en', '--nope']],
  ];
  for (const [name, args] of pyUnknown)
    test.skipIf(!python)(
      `${name}（依存を入れる前でも止める）`,
      () => {
        const r = runChild([python ?? 'python3', ...args]);
        expect({ code: r.code, changed: r.changed, cache: r.cache }).toEqual({ code: 2, changed: [], cache: [] });
        expect(r.stderr.trim()).not.toBe('');
      },
      60_000,
    );
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
